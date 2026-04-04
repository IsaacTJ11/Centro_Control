import psycopg2.pool

_pool = None

def get_pool():
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=5,
            host='10.156.3.71',
            port='5432',
            user='postgres',
            password='admin',
            database='centrocontrolDB',
            connect_timeout=3
        )
    return _pool