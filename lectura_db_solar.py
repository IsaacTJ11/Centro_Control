import psycopg2
import pandas as pd
from datetime import datetime, timedelta, time
from contextlib import contextmanager
from db_pool import get_pool

# Mapa de prefijos a nombre de central para la tabla solar_status
# "R_" -> Rubí, "C_" -> Clemesí, "RUBI" / "CLEMESI" (sin prefijo) -> CENTRAL
PREFIJO_CENTRAL = {
    'R': 'Rubí',
    'C': 'Clemesí',
}

def get_central_solar(nombre_inversor: str) -> str:
    """
    Determina la central solar según el prefijo del inversor.
    - "R_XXX" -> "Rubí"
    - "C_XXX" -> "Clemesí"
    - "RUBI" / "CLEMESI" (sin separador de prefijo) -> "CENTRAL"
    """
    if not nombre_inversor:
        return 'CENTRAL'
    upper = nombre_inversor.upper()
    if upper.startswith('R_'):
        return 'Rubí'
    if upper.startswith('C_'):
        return 'Clemesí'
    # Sin prefijo reconocido (nombre de la subestación/central completa)
    return 'CENTRAL'


class SolarDataReader:
    """Clase para leer datos de inversores solares desde la base de datos"""

    def __init__(self, host='10.156.3.71', port='5432', user='postgres', password='admin', database='centrocontrolDB'):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.database = database

    @contextmanager
    def get_connection(self):
        pool = get_pool()
        connection = None
        try:
            connection = pool.getconn()
            yield connection
        except psycopg2.Error as e:
            print(f"Error de conexión: {e}")
            if connection:
                connection.rollback()
            raise
        finally:
            if connection:
                pool.putconn(connection)

    def execute_recalculate_values(self):
        """Ejecuta la función recalculate_values en la base de datos (si aplica para solar)"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT public.recalculate_values();")
                conn.commit()
                return True
        except Exception as e:
            print(f"Error al ejecutar recalculate_values: {e}")
            return False

    def _format_tiempo(self, tiempo_value, fecha_fin_str: str) -> str:
        """Formatea minutos totales al string de tiempo legible (Xd Xh / Xh Xm / Xh)"""
        if pd.isna(tiempo_value) or tiempo_value is None:
            return ""
        total_minutos = int(tiempo_value)
        dias = total_minutos // 1440
        horas = (total_minutos % 1440) // 60
        minutos = total_minutos % 60

        if dias > 0:
            return f"{dias}d {horas}h"
        elif 58 <= total_minutos < 120:
            return "1h"
        else:
            if fecha_fin_str == "":
                return f"{horas}h {minutos}m"
            else:
                return f"{horas}h"

    def _format_nombre_inversor(self, nombre: str) -> str:
        """
        Formatea el nombre del inversor para mostrarlo en la web.
        Conserva el nombre original sin cambios (el prefijo R_/C_ ya comunica la central).
        Si el nombre es exactamente 'RUBI' o 'CLEMESI', retorna 'CENTRAL'.
        """
        if not nombre:
            return nombre
        upper = nombre.upper()
        if upper in ('RUBI', 'CLEMESI'):
            return 'CENTRAL'
        # Eliminar prefijo R_ o C_
        if upper.startswith('R_') or upper.startswith('C_'):
            return nombre[2:]
        return nombre

    def get_inversores_falla(self):
        """Obtiene inversores solares en estado de FALLA"""
        with self.get_connection() as conn:
            query = """
            WITH RECURSIVE chain_complete AS (
                -- Registros base que cumplen la condición de 24h
                SELECT id, inversor, circuito, fecha_inicio, fecha_fin, tipo,
                    tiempo, status, unido
                FROM public.solar_status
                WHERE tipo = 'FALLA'
                AND (fecha_fin IS NULL OR fecha_fin > NOW() - INTERVAL '24 hours')
                AND (unido IS NULL OR unido NOT IN ('ELIMINADO'))

                UNION

                -- Recursivamente obtener registros anteriores en la cadena
                SELECT s.id, s.inversor, s.circuito, s.fecha_inicio, s.fecha_fin, s.tipo,
                    s.tiempo, s.status, s.unido
                FROM public.solar_status s
                INNER JOIN chain_complete c ON CAST(REPLACE(s.unido, '_M', '') AS INTEGER) = c.id
                WHERE s.tipo = 'FALLA'
                AND (s.unido IS NOT NULL AND s.unido NOT IN ('ELIMINADO', '', '0', 'SEPARADO'))
            )
            SELECT DISTINCT id, inversor, circuito, fecha_inicio, fecha_fin, tipo, tiempo, status
            FROM chain_complete
            ORDER BY fecha_inicio ASC
            """

            df = pd.read_sql_query(query, conn)

            inversores_falla = []
            for _, row in df.iterrows():
                fecha_inicio = pd.to_datetime(row['fecha_inicio'])

                if pd.notna(row['fecha_fin']) and row['fecha_fin'] is not None:
                    fecha_fin = pd.to_datetime(row['fecha_fin'])
                    fecha_fin_str = fecha_fin.strftime("%d/%m/%y %H:%M")
                else:
                    fecha_fin_str = ""

                tiempo_str = self._format_tiempo(row.get('tiempo'), fecha_fin_str)
                status = row.get('status', '')
                nombre_raw = row['inversor']
                nombre_formateado = self._format_nombre_inversor(nombre_raw)
                central = get_central_solar(nombre_raw)

                inversores_falla.append({
                    "id": row['id'],
                    "nombre": nombre_formateado,
                    "nombre_raw": nombre_raw,
                    "central": central,
                    "circuito": row['circuito'],
                    "fecha_inicio": fecha_inicio.strftime("%d/%m/%y %H:%M"),
                    "fecha_fin": fecha_fin_str,
                    "tiempo": tiempo_str,
                    "status": status,
                    "tipo": row['tipo']
                })

            print(f"Inversores solares en falla obtenidos: {len(inversores_falla)}")
            return inversores_falla

    def get_inversores_mantenimiento(self):
        """Obtiene inversores solares en estado de MANT"""
        with self.get_connection() as conn:
            query = """
            WITH RECURSIVE chain_complete AS (
                SELECT id, inversor, circuito, fecha_inicio, fecha_fin, tipo, tiempo, status, unido
                FROM public.solar_status
                WHERE tipo = 'MANT'
                AND (fecha_fin IS NULL OR fecha_fin > NOW() - INTERVAL '24 hours')
                AND (unido IS NULL OR unido NOT IN ('ELIMINADO'))

                UNION

                SELECT s.id, s.inversor, s.circuito, s.fecha_inicio, s.fecha_fin, s.tipo, s.tiempo, s.status, s.unido
                FROM public.solar_status s
                INNER JOIN chain_complete c ON CAST(REPLACE(s.unido, '_M', '') AS INTEGER) = c.id
                WHERE s.tipo = 'MANT'
                AND (s.unido IS NOT NULL AND s.unido NOT IN ('ELIMINADO', '', '0', 'SEPARADO'))
            )
            SELECT DISTINCT id, inversor, circuito, fecha_inicio, fecha_fin, tipo, tiempo, status
            FROM chain_complete
            ORDER BY fecha_inicio ASC
            """

            df = pd.read_sql_query(query, conn)

            inversores_mantenimiento = []
            for _, row in df.iterrows():
                fecha_inicio = pd.to_datetime(row['fecha_inicio'])

                if pd.notna(row['fecha_fin']) and row['fecha_fin'] is not None:
                    fecha_fin = pd.to_datetime(row['fecha_fin'])
                    fecha_fin_str = fecha_fin.strftime("%d/%m/%y %H:%M")
                else:
                    fecha_fin_str = ""

                tiempo_str = self._format_tiempo(row.get('tiempo'), fecha_fin_str)
                status = row.get('status', '')
                nombre_raw = row['inversor']
                nombre_formateado = self._format_nombre_inversor(nombre_raw)
                central = get_central_solar(nombre_raw)

                inversores_mantenimiento.append({
                    "id": row['id'],
                    "nombre": nombre_formateado,
                    "nombre_raw": nombre_raw,
                    "central": central,
                    "circuito": row['circuito'],
                    "fecha_inicio": fecha_inicio.strftime("%d/%m/%y %H:%M"),
                    "fecha_fin": fecha_fin_str,
                    "tiempo": tiempo_str,
                    "status": status,
                    "tipo": row['tipo']
                })

            print(f"Inversores solares en mantenimiento obtenidos: {len(inversores_mantenimiento)}")
            return inversores_mantenimiento

    def find_continuous_records(self, inversores_list):
        """Identifica y agrupa registros unidos usando la columna 'unido'"""
        if not inversores_list:
            return []

        try:
            with self.get_connection() as conn:
                ids = [inv['id'] for inv in inversores_list]
                if not ids:
                    return inversores_list

                query = """
                SELECT id, unido
                FROM public.solar_status
                WHERE id = ANY(%s)
                """
                df = pd.read_sql_query(query, conn, params=(ids,))

                unido_map = {}
                for _, row in df.iterrows():
                    unido_map[row['id']] = row['unido']

                inversores_dict = {inv['id']: inv for inv in inversores_list}
                processed_ids = set()
                result = []

                for inv in inversores_list:
                    inv_id = inv['id']
                    if inv_id in processed_ids:
                        continue

                    unido_value = unido_map.get(inv_id)

                    if unido_value is None or str(unido_value).strip() in ('', '0', 'SEPARADO'):
                        result.append(inv)
                        processed_ids.add(inv_id)
                    else:
                        chain = [inv]
                        processed_ids.add(inv_id)
                        current_id = inv_id

                        while True:
                            unido_value = unido_map.get(current_id)
                            if unido_value is None or str(unido_value).strip() in ('', '0'):
                                break

                            next_id_str = str(unido_value).replace('_M', '')
                            try:
                                next_id = int(next_id_str)
                            except ValueError:
                                break

                            next_inv = inversores_dict.get(next_id)
                            if next_inv is None or next_id in processed_ids:
                                break

                            chain.append(next_inv)
                            processed_ids.add(next_id)
                            current_id = next_id

                        if len(chain) > 1:
                            first = chain[0]
                            last = chain[-1]

                            tipo_priority = {'FALLA': 2, 'MANT': 1}
                            max_tipo = max(chain, key=lambda x: tipo_priority.get(x['tipo'], 0))['tipo']

                            unified = {
                                'id': first['id'],
                                'nombre': first['nombre'] + '*',
                                'nombre_raw': first['nombre_raw'],
                                'central': first['central'],
                                'circuito': first['circuito'],
                                'fecha_inicio': first['fecha_inicio'],
                                'fecha_fin': last.get('fecha_fin', ''),
                                'tiempo': self._calculate_unified_time(chain),
                                'status': last.get('status', ''),
                                'tipo': max_tipo,
                                'is_unified': True,
                                'component_records': chain
                            }
                            result.append(unified)
                        else:
                            result.append(inv)

                return result

        except Exception as e:
            print(f"Error en find_continuous_records (solar): {e}")
            import traceback
            traceback.print_exc()
            return inversores_list

    def _calculate_unified_time(self, records):
        """Calcula el tiempo total desde fecha_inicio del primero hasta fecha_fin del último (o ahora)"""
        if not records:
            return ""

        first = records[0]
        last = records[-1]

        fecha_inicio = datetime.strptime(first['fecha_inicio'], "%d/%m/%y %H:%M")

        if last['fecha_fin'] and last['fecha_fin'].strip():
            fecha_fin = datetime.strptime(last['fecha_fin'], "%d/%m/%y %H:%M")
            is_open = False
        else:
            fecha_fin = datetime.now()
            is_open = True

        total_minutos = int((fecha_fin - fecha_inicio).total_seconds() / 60)
        dias = total_minutos // 1440
        horas = (total_minutos % 1440) // 60
        minutos = total_minutos % 60

        if dias > 0:
            return f"{dias}d {horas}h"
        elif 58 <= total_minutos < 120:
            return "1h"
        else:
            if is_open:
                return f"{horas}h {minutos}m"
            else:
                return f"{horas}h"

    def get_all_solar_data(self):
        """Obtiene todos los datos de inversores, unificados y separados por central"""
        falla_data = self.get_inversores_falla()
        mant_data = self.get_inversores_mantenimiento()

        todos = falla_data + mant_data
        todos = self.find_continuous_records(todos)

        rubi = []
        clemesi = []
        central = []

        for inv in todos:
            c = inv.get('central', 'CENTRAL')
            if c == 'Rubí':
                rubi.append(inv)
            elif c == 'Clemesí':
                clemesi.append(inv)
            else:
                central.append(inv)

        return {
            'rubi': rubi,
            'clemesi': clemesi,
            'central': central  # inversores cuyo nombre es RUBI o CLEMESI (nivel central)
        }

    def get_daily_report_data(self):
        """Obtiene datos para el reporte diario de inversores solares a las 23:45"""
        try:
            with self.get_connection() as conn:
                now = datetime.now()
                current_hour = now.hour
                current_minute = now.minute

                if 8 <= current_hour < 20:
                    reference_date = (now.date() - timedelta(days=1))
                elif current_hour >= 20 and (current_hour < 23 or (current_hour == 23 and current_minute < 45)):
                    reference_date = (now.date() - timedelta(days=1))
                else:
                    reference_date = now.date()

                reference_time = time(23, 45, 0)
                reference_datetime = datetime.combine(reference_date, reference_time)

                query = """
                SELECT
                    s.id,
                    s.inversor,
                    s.circuito,
                    s.fecha_inicio,
                    s.fecha_fin,
                    s.tipo
                FROM public.solar_status s
                WHERE
                    s.fecha_inicio < %s
                    AND (s.fecha_fin IS NULL OR s.fecha_fin > %s)
                ORDER BY s.fecha_inicio ASC
                """

                df = pd.read_sql_query(query, conn, params=(reference_datetime, reference_datetime))

                # Obtener IDs excluidos (componentes de registros unificados)
                all_falla = self.get_inversores_falla()
                all_mant = self.get_inversores_mantenimiento()
                all_data = all_falla + all_mant
                unified_data = self.find_continuous_records(all_data)

                excluded_ids = set()
                for record in unified_data:
                    if record.get('is_unified'):
                        for comp in record['component_records']:
                            excluded_ids.add(comp['id'])

                report_data = []
                for _, row in df.iterrows():
                    if row['id'] in excluded_ids:
                        continue

                    nombre_raw = row['inversor']
                    central_nombre = get_central_solar(nombre_raw)
                    nombre_formateado = self._format_nombre_inversor(nombre_raw)

                    fecha_inicio = pd.to_datetime(row['fecha_inicio'])

                    if fecha_inicio >= reference_datetime:
                        continue

                    fecha_inicio_str = fecha_inicio.strftime("%d/%m/%y %H:%M")

                    if pd.notna(row['fecha_fin']) and row['fecha_fin'] is not None:
                        fecha_fin = pd.to_datetime(row['fecha_fin'])
                        if fecha_fin <= reference_datetime:
                            continue
                        fecha_fin_str = fecha_fin.strftime("%d/%m/%y %H:%M")
                        estado_actual = "E/S"
                        estado_clase = "status-ok"
                    else:
                        fecha_fin_str = ""
                        estado_actual = "F/S"
                        estado_clase = "status-error"

                    descripcion = "Mantenimiento programado" if row['tipo'] == 'MANT' else ""

                    report_data.append({
                        "central": central_nombre,
                        "inversor": nombre_formateado,
                        "circuito": f"C-{str(row['circuito']).zfill(2)}",
                        "hora_inicio": fecha_inicio_str,
                        "descripcion": descripcion,
                        "estado_actual": estado_actual,
                        "estado_clase": estado_clase,
                        "hora_fin": fecha_fin_str
                    })

                # Ordenar: Rubí primero, Clemesí segundo, Central al final; luego por fecha
                orden_central = {'Rubí': 0, 'Clemesí': 1, 'CENTRAL': 2}
                report_data.sort(key=lambda x: (
                    orden_central.get(x['central'], 9),
                    x['hora_inicio']
                ))

                print(f"Datos de reporte diario solar obtenidos: {len(report_data)} registros")
                return report_data

        except Exception as e:
            print(f"Error al obtener datos de reporte diario solar: {e}")
            import traceback
            traceback.print_exc()
            return []

    def test_connection(self):
        """Prueba la conexión a la base de datos"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM public.solar_status;")
                count = cursor.fetchone()
                print(f"Conexión exitosa. Registros en solar_status: {count[0]}")
                return True
        except Exception as e:
            print(f"Error al probar la conexión: {e}")
            return False


# Funciones de conveniencia para uso en Flask
def get_solar_data():
    """Retorna datos de inversores solares para Flask"""
    reader = SolarDataReader()
    return reader.get_all_solar_data()


def get_daily_report_data_solar():
    """Retorna datos del reporte diario solar para Flask"""
    reader = SolarDataReader()
    return reader.get_daily_report_data()


if __name__ == "__main__":
    reader = SolarDataReader()
    if reader.test_connection():
        data = reader.get_all_solar_data()
        print(f"Inversores Rubí: {len(data['rubi'])}")
        print(f"Inversores Clemesí: {len(data['clemesi'])}")
        print(f"Inversores CENTRAL: {len(data['central'])}")
    else:
        print("Error en la conexión a base de datos")