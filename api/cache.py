"""Caché compartida para datos de terceros (spec 020): Redis si hay REDIS_URL, memoria del proceso si no.

Sirve para que muchas personas abriendo «Tormentas» a la vez no se traduzcan en muchas descargas a NASA, NOAA,
UCAR u Open-Meteo: la primera petición baja el dato y las demás lo leen de aquí.

  * `una_vez(clave, ttl, fn)`: devuelve lo guardado; si no hay, UNA sola petición (en todos los procesos, con un
    candado en Redis) llama a `fn` y guarda el resultado; las demás esperan ese resultado en vez de bajar lo mismo.
  * Si `fn` falla (sin internet, servicio caído), se devuelve la última copia buena (se guarda aparte con un plazo
    largo) para que la app siga mostrando algo, marcada como vieja. El fallo queda anotado un rato (`ttl_fallo`):
    mientras tanto nadie vuelve a intentar la descarga, así un servicio caído no recibe una petición por visita.
  * Si Redis se cae, la API sigue con la memoria del proceso y vuelve a probar Redis cada 30 s.

Los valores son bytes; `una_vez_json` guarda y devuelve objetos JSON.
"""
import json
import os
import threading
import time
import uuid

try:
    import redis   # opcional en desarrollo y pruebas; en Docker está (api/requirements.txt)
except ImportError:      # pragma: no cover
    redis = None

PREFIJO = "yw:"
VIEJO = ":viejo"        # sufijo de la última copia buena
FALLO = ":fallo"        # sufijo de la marca «falló hace poco: no insistir»
TTL_VIEJO = 6 * 3600     # cuánto se guarda la última copia buena


class SinDato(Exception):
    """No hay dato fresco ni copia vieja (el servicio de origen falló y nunca hubo uno bueno)."""


class _Memoria:
    """Lo mínimo de Redis que se usa, en un diccionario con vencimiento (un solo proceso)."""

    def __init__(self):
        self._d = {}
        self._l = threading.Lock()

    def get(self, k):
        with self._l:
            v = self._d.get(k)
            if not v:
                return None
            if v[1] and v[1] < time.monotonic():
                del self._d[k]
                return None
            return v[0]

    def set(self, k, valor, ex=None, nx=False):
        with self._l:
            actual = self._d.get(k)
            if nx and actual and (not actual[1] or actual[1] >= time.monotonic()):
                return None
            self._d[k] = (valor, time.monotonic() + ex if ex else None)
            if len(self._d) > 2000:          # tope: se van los que vencen antes
                for kk in sorted(self._d, key=lambda x: self._d[x][1] or float("inf"))[:500]:
                    del self._d[kk]
            return True

    def delete(self, k):
        with self._l:
            self._d.pop(k, None)

    def eval_soltar(self, k, dueño):
        with self._l:
            v = self._d.get(k)
            if v and v[0] == dueño:
                del self._d[k]


class Cache:
    def __init__(self, url=None):
        self.url = url if url is not None else (os.environ.get("REDIS_URL") or "")
        self.mem = _Memoria()
        self._r = None
        self._caido_hasta = 0.0
        self._aviso = False
        self._locales = {}                    # un candado por clave dentro del proceso
        self._l = threading.Lock()

    # ------------------------------------------------------------------ conexión
    def _redis(self):
        if not self.url or redis is None or time.monotonic() < self._caido_hasta:
            return None
        if self._r is None:
            self._r = redis.Redis.from_url(self.url, socket_timeout=3, socket_connect_timeout=3)
        return self._r

    def _fallo(self, e):
        self._caido_hasta = time.monotonic() + 30
        self._r = None
        if not self._aviso:
            print(f"  [aviso] Redis no responde ({e.__class__.__name__}); sigo con la memoria del proceso")
            self._aviso = True

    def _op(self, nombre, *a, **kw):
        r = self._redis()
        if r is not None:
            try:
                res = getattr(r, nombre)(*a, **kw)
                self._aviso = False
                return res
            except Exception as e:      # ConnectionError, TimeoutError, …
                self._fallo(e)
        return getattr(self.mem, nombre)(*a, **kw)

    def usa_redis(self):
        r = self._redis()
        if r is None:
            return False
        try:
            return bool(r.ping())
        except Exception as e:
            self._fallo(e)
            return False

    # ------------------------------------------------------------------ básico
    def get(self, clave):
        return self._op("get", PREFIJO + clave)

    def set(self, clave, valor, ttl):
        self._op("set", PREFIJO + clave, valor, ex=max(1, int(ttl)))

    def borrar(self, clave):
        for suf in ("", VIEJO, FALLO):
            self._op("delete", PREFIJO + clave + suf)

    def _tomar(self, clave, ttl):
        dueño = uuid.uuid4().hex
        ok = self._op("set", PREFIJO + "candado:" + clave, dueño, ex=ttl, nx=True)
        return dueño if ok else None

    def _soltar(self, clave, dueño):
        k = PREFIJO + "candado:" + clave
        r = self._redis()
        if r is not None:
            try:
                # solo lo suelta quien lo tomó (si venció y lo tomó otro, no se lo quita)
                r.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0",
                       1, k, dueño)
                return
            except Exception as e:
                self._fallo(e)
        self.mem.eval_soltar(k, dueño)

    def _local(self, clave):
        with self._l:
            if len(self._locales) > 500:          # una clave por imagen: se olvidan las que nadie está usando
                self._locales = {k: v for k, v in self._locales.items() if v.locked()}
            return self._locales.setdefault(clave, threading.Lock())

    # ------------------------------------------------------------------ una sola descarga
    def _viejo_o_nada(self, clave):
        viejo = self.get(clave + VIEJO)
        if viejo is not None:
            return viejo, True
        raise SinDato(clave)

    def una_vez(self, clave, ttl, fn, espera=25, ttl_fallo=60):
        """Devuelve (valor_bytes, viejo). viejo=True si `fn` falló y se usó la última copia buena.
        Lanza SinDato si no hay nada que devolver."""
        v = self.get(clave)
        if v is not None:
            return v, False
        if self.get(clave + FALLO) is not None:          # falló hace poco: no se insiste
            return self._viejo_o_nada(clave)
        with self._local(clave):                     # dentro del proceso: un hilo baja, los demás esperan aquí
            v = self.get(clave)
            if v is not None:
                return v, False
            if self.get(clave + FALLO) is not None:      # falló mientras se esperaba el candado local
                return self._viejo_o_nada(clave)
            dueño = self._tomar(clave, espera + 5)
            if dueño is None:                         # otro proceso lo está bajando: se espera su resultado
                fin = time.monotonic() + espera
                while time.monotonic() < fin:
                    time.sleep(0.25)
                    v = self.get(clave)
                    if v is not None:
                        return v, False
                return self._viejo_o_nada(clave)
            try:
                try:
                    v = fn()
                except Exception as e:
                    print(f"  [aviso] no se pudo actualizar {clave}: {e.__class__.__name__}: {e}")
                    self.set(clave + FALLO, b"1", ttl_fallo)
                    try:
                        return self._viejo_o_nada(clave)
                    except SinDato:
                        raise SinDato(clave) from e
                self.set(clave, v, ttl)
                self.set(clave + VIEJO, v, max(ttl, TTL_VIEJO))
                return v, False
            finally:
                self._soltar(clave, dueño)

    def una_vez_json(self, clave, ttl, fn, espera=25, ttl_fallo=60):
        v, viejo = self.una_vez(clave, ttl, lambda: json.dumps(fn(), separators=(",", ":")).encode("utf-8"), espera,
                                ttl_fallo)
        return json.loads(v), viejo


CACHE = Cache()
