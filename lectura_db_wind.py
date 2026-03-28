import psycopg2
import pandas as pd
from datetime import datetime, timedelta, time
from contextlib import contextmanager

class WindDataReader:
    """Clase para leer datos de aerogeneradores desde la base de datos"""
    
    def __init__(self, host='10.156.3.71', port='5432', user='postgres', password='admin', database='centrocontrolDB'):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.database = database
    
    @contextmanager
    def get_connection(self):
        """Context manager para manejo seguro de conexiones"""
        connection = None
        try:
            connection = psycopg2.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.database,
                connect_timeout=3
            )
            yield connection
            
        except psycopg2.Error as e:
            print(f"Error de conexión a la base de datos: {e}")
            if connection:
                connection.rollback()
            raise
            
        finally:
            if connection:
                connection.close()
    
    def execute_recalculate_values(self):
        """Ejecuta la función recalculate_values en la base de datos"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT public.recalculate_values();")
                conn.commit()
                # print("Función recalculate_values ejecutada exitosamente") # Commented out to reduce noise
                return True
        except Exception as e:
            print(f"Error al ejecutar recalculate_values: {e}")
            return False

    
    def format_reporte_value(self, value, reporte_type):
        """Formatea los valores de reporte según las reglas especificadas"""
        if value is None:
            return ""
        
        if reporte_type == "J5":
            if value is True or value == 1:
                return "J5 ✓"
            elif value is False or value == 0:
                return "J5 ✗"
            else:
                return ""
        elif reporte_type == "304":
            if value == 0:
                return "PR-304 ✓"
            elif value == 1:
                return "PR-304 ✗"
            else:
                return ""
        elif reporte_type == "264":
            if value == 0:
                return "PR-264 ✓"
            elif value == 1:
                return "PR-264 ✗"
            else:
                return ""
        else:
            return ""

    def get_aerogeneradores_falla(self):
        """Obtiene aerogeneradores en estado de falla"""
        with self.get_connection() as conn:
            query = """
            WITH RECURSIVE chain_complete AS (
                -- Registros base que cumplen la condición de 24h
                SELECT id, aero, circuito, fecha_inicio, fecha_fin, tipo, 
                    reporte304, reporte264, reportej5, tiempo, status, unido
                FROM wind_status 
                WHERE tipo IN ('FALLA', 'STOP', 'PAUSA')
                AND (fecha_fin IS NULL OR fecha_fin > NOW() - INTERVAL '24 hours')
                AND (unido IS NULL OR unido NOT IN ('ELIMINADO'))
                
                UNION
                
                -- Recursivamente obtener registros anteriores en la cadena
                SELECT w.id, w.aero, w.circuito, w.fecha_inicio, w.fecha_fin, w.tipo,
                    w.reporte304, w.reporte264, w.reportej5, w.tiempo, w.status, w.unido
                FROM wind_status w
                INNER JOIN chain_complete c ON CAST(REPLACE(w.unido, '_M', '') AS INTEGER) = c.id
                WHERE w.tipo IN ('FALLA', 'STOP', 'PAUSA')
                AND (w.unido IS NOT NULL AND w.unido NOT IN ('ELIMINADO', '', '0', 'SEPARADO'))
            )
            SELECT DISTINCT id, aero, circuito, fecha_inicio, fecha_fin, tipo,
                reporte304, reporte264, reportej5, tiempo, status
            FROM chain_complete
            ORDER BY fecha_inicio ASC
            """
            
            df = pd.read_sql_query(query, conn)
            
            # Convertir a formato para el template
            aerogeneradores_falla = []
            for _, row in df.iterrows():
                fecha_inicio = pd.to_datetime(row['fecha_inicio'])
                
                # Formatear fecha_fin
                if pd.notna(row['fecha_fin']) and row['fecha_fin'] is not None:
                    fecha_fin = pd.to_datetime(row['fecha_fin'])
                    fecha_fin_str = fecha_fin.strftime("%d/%m/%y %H:%M")
                else:
                    fecha_fin_str = ""
                
                # Formatear tiempo desde la base de datos (en minutos)
                tiempo_value = row.get('tiempo')
                if pd.notna(tiempo_value) and tiempo_value is not None:
                    total_minutos = int(tiempo_value)
                    dias = total_minutos // 1440
                    horas = (total_minutos % 1440) // 60
                    minutos = total_minutos % 60
                    
                    if dias > 0:
                        tiempo_str = f"{dias}d {horas}h"
                    elif total_minutos >= 58 and total_minutos < 120:
                        # Redondear a "1h" si está entre 58-119 minutos
                        tiempo_str = "1h"
                    else:
                        if fecha_fin_str == "":
                            tiempo_str = f"{horas}h {minutos}m"
                        else:
                            tiempo_str = f"{horas}h"
                else:
                    tiempo_str = ""
                
                # Obtener status desde la base de datos
                status = row.get('status', '')
                
                # Formatear reportes usando los valores de la base de datos
                reporte_j5 = self.format_reporte_value(row.get('reportej5'), "J5")
                reporte_304 = self.format_reporte_value(row.get('reporte304'), "304")
                reporte_264 = self.format_reporte_value(row.get('reporte264'), "264")
                
                # Extraer solo el número del aero (ej: "WTG63" -> 63)
                aero_nombre = row['aero']
                if isinstance(aero_nombre, str) and aero_nombre.startswith('WTG'):
                    aero_num = int(aero_nombre.replace('WTG', ''))
                    nombre_formateado = f"WTG{aero_num:02d}"
                else:
                    nombre_formateado = aero_nombre
                
                aerogeneradores_falla.append({
                    "id": row['id'],
                    "nombre": nombre_formateado,
                    "circuito": row['circuito'],
                    "fecha_inicio": fecha_inicio.strftime("%d/%m/%y %H:%M"),
                    "fecha_fin": fecha_fin_str,
                    "tiempo": tiempo_str,
                    "reporteJ5": reporte_j5,
                    "reporte304": reporte_304,
                    "reporte264": reporte_264,
                    "status": status,
                    "tipo": row['tipo']
                })
            
            print(f"Aerogeneradores en falla obtenidos: {len(aerogeneradores_falla)}")
            return aerogeneradores_falla
 
    def get_aerogeneradores_mantenimiento(self):
        """Obtiene aerogeneradores en estado de mantenimiento"""
        with self.get_connection() as conn:
            query = """
            WITH RECURSIVE chain_complete AS (
                -- Registros base que cumplen la condición de 24h
                SELECT id, aero, circuito, fecha_inicio, fecha_fin, tipo, tiempo, status, unido
                FROM wind_status
                WHERE tipo = 'MANT'
                AND (fecha_fin IS NULL OR fecha_fin > NOW() - INTERVAL '24 hours')
                AND (unido IS NULL OR unido NOT IN ('ELIMINADO'))
                
                UNION
                
                -- Recursivamente obtener registros anteriores en la cadena
                SELECT w.id, w.aero, w.circuito, w.fecha_inicio, w.fecha_fin, w.tipo, w.tiempo, w.status, w.unido
                FROM wind_status w
                INNER JOIN chain_complete c ON CAST(REPLACE(w.unido, '_M', '') AS INTEGER) = c.id
                WHERE w.tipo = 'MANT'
                AND (w.unido IS NOT NULL AND w.unido NOT IN ('ELIMINADO', '', '0', 'SEPARADO'))
            )
            SELECT DISTINCT id, aero, circuito, fecha_inicio, fecha_fin, tipo, tiempo, status
            FROM chain_complete
            ORDER BY fecha_inicio ASC
            """
            
            df = pd.read_sql_query(query, conn)
            
            # Convertir a formato para el template
            aerogeneradores_mantenimiento = []
            for _, row in df.iterrows():
                fecha_inicio = pd.to_datetime(row['fecha_inicio'])
                
                # Formatear fecha_fin
                if pd.notna(row['fecha_fin']) and row['fecha_fin'] is not None:
                    fecha_fin = pd.to_datetime(row['fecha_fin'])
                    fecha_fin_str = fecha_fin.strftime("%d/%m/%y %H:%M")
                else:
                    fecha_fin_str = ""
                
                # Formatear tiempo desde la base de datos (en minutos)
                tiempo_value = row.get('tiempo')
                if pd.notna(tiempo_value) and tiempo_value is not None:
                    total_minutos = int(tiempo_value)
                    dias = total_minutos // 1440
                    horas = (total_minutos % 1440) // 60
                    minutos = total_minutos % 60
                    
                    if dias > 0:
                        tiempo_str = f"{dias}d {horas}h"
                    elif total_minutos >= 58 and total_minutos < 120:
                        # Redondear a "1h" si está entre 58-119 minutos
                        tiempo_str = "1h"
                    else:
                        if fecha_fin_str == "":
                            tiempo_str = f"{horas}h {minutos}m"
                        else:
                            tiempo_str = f"{horas}h"
                else:
                    tiempo_str = ""
                
                # Obtener status desde la base de datos
                status = row.get('status', '')
                
                # Extraer solo el número del aero (ej: "WTG63" -> 63)
                aero_nombre = row['aero']
                if isinstance(aero_nombre, str) and aero_nombre.startswith('WTG'):
                    aero_num = int(aero_nombre.replace('WTG', ''))
                    nombre_formateado = f"WTG{aero_num:02d}"
                else:
                    nombre_formateado = aero_nombre
                
                aerogeneradores_mantenimiento.append({
                    "id": row['id'],
                    "nombre": nombre_formateado,
                    "circuito": row['circuito'],
                    "fecha_inicio": fecha_inicio.strftime("%d/%m/%y %H:%M"),
                    "fecha_fin": fecha_fin_str,
                    "tiempo": tiempo_str,
                    "status": status,
                    "tipo": row['tipo']
                })
            
            print(f"Aerogeneradores en mantenimiento obtenidos: {len(aerogeneradores_mantenimiento)}")
            return aerogeneradores_mantenimiento
         
    def find_continuous_records(self, aeros_list):
        """Identifica y agrupa registros unidos usando la columna 'unido'"""
        if not aeros_list:
            return []
        
        try:
            with self.get_connection() as conn:
                # Obtener todos los IDs de los registros en aeros_list
                ids = [aero['id'] for aero in aeros_list]
                
                if not ids:
                    return aeros_list
                
                # Consultar la columna 'unido' para estos registros
                query = """
                SELECT id, unido 
                FROM wind_status 
                WHERE id = ANY(%s)
                """
                
                df = pd.read_sql_query(query, conn, params=(ids,))
                
                # Crear un diccionario de id -> unido
                unido_map = {}
                for _, row in df.iterrows():
                    unido_map[row['id']] = row['unido']
                
                # Crear un diccionario de aeros por ID para acceso rápido
                aeros_dict = {aero['id']: aero for aero in aeros_list}
                
                # Identificar cadenas de registros unidos
                processed_ids = set()
                result = []
                
                for aero in aeros_list:
                    aero_id = aero['id']
                    
                    # Si ya fue procesado como parte de una cadena, saltar
                    if aero_id in processed_ids:
                        continue
                    
                    # Verificar si este registro tiene 'unido' válido (no nulo, no '0', no vacío)
                    unido_value = unido_map.get(aero_id)

                    if unido_value is None or str(unido_value).strip() in ('', '0', 'SEPARADO'):
                        # Registro simple sin unión
                        result.append(aero)
                        processed_ids.add(aero_id)
                    else:
                        # Este es el inicio de una cadena de registros unidos
                        chain = [aero]
                        processed_ids.add(aero_id)
                        
                        current_id = aero_id
                        
                        # Seguir la cadena de 'unido'
                        while True:
                            unido_value = unido_map.get(current_id)
                            
                            if unido_value is None or str(unido_value).strip() == '' or str(unido_value).strip() == '0':
                                break
                            
                            # Extraer el ID (eliminar sufijos _M si existen)
                            next_id_str = str(unido_value).replace('_M', '')
                            try:
                                next_id = int(next_id_str)
                            except ValueError:
                                break
                            
                            # Buscar el siguiente registro
                            next_aero = aeros_dict.get(next_id)
                            
                            if next_aero is None:
                                break
                            
                            if next_id in processed_ids:
                                break
                            
                            chain.append(next_aero)
                            processed_ids.add(next_id)
                            current_id = next_id
                        
                        # Si hay más de un registro en la cadena, crear registro unificado
                        if len(chain) > 1:
                            # Crear registro unificado
                            first = chain[0]
                            last = chain[-1]
                            
                            # Determinar tipo de mayor importancia
                            tipo_priority = {'FALLA': 4, 'STOP': 3, 'PAUSA': 2, 'MANT': 1}
                            max_tipo = max(chain, key=lambda x: tipo_priority.get(x['tipo'], 0))['tipo']
                            
                            unified = {
                                'id': first['id'],
                                'nombre': first['nombre'] + '*',  # Asterisco para indicar unión
                                'circuito': first['circuito'],
                                'fecha_inicio': first['fecha_inicio'],
                                'fecha_fin': last.get('fecha_fin', ''),
                                'tiempo': self._calculate_unified_time(chain),
                                'reporteJ5': first.get('reporteJ5', ''),
                                'reporte304': first.get('reporte304', ''),
                                'reporte264': first.get('reporte264', ''),
                                'status': last.get('status', ''),
                                'tipo': max_tipo,
                                'is_unified': True,
                                'component_records': chain
                            }
                            
                            result.append(unified)
                        else:
                            # Solo un registro, agregar normalmente
                            result.append(aero)
                
                return result
                
        except Exception as e:
            print(f"Error en find_continuous_records: {e}")
            import traceback
            traceback.print_exc()
            return aeros_list

    def _extract_total_minutos(self, tiempo_str):
        """Extrae el total de minutos de un string de tiempo"""
        if not tiempo_str or tiempo_str.strip() == '':
            return 0
        
        dias = 0
        horas = 0
        minutos = 0
        
        # Extraer días
        if 'd' in tiempo_str:
            match = __import__('re').search(r'(\d+)d', tiempo_str)
            if match:
                dias = int(match.group(1))
        
        # Extraer horas
        if 'h' in tiempo_str:
            match = __import__('re').search(r'(\d+)h', tiempo_str)
            if match:
                horas = int(match.group(1))
        
        # Extraer minutos
        if 'm' in tiempo_str:
            match = __import__('re').search(r'(\d+)m', tiempo_str)
            if match:
                minutos = int(match.group(1))
        
        return (dias * 1440) + (horas * 60) + minutos
    
    def _calculate_unified_time(self, records):
        """Calcula el tiempo total desde fecha_inicio del primero hasta fecha_fin del último (o ahora si está abierto)"""
        from datetime import datetime
        
        if not records:
            return ""
        
        first = records[0]
        last = records[-1]
        
        # Parsear fecha_inicio del primer registro
        fecha_inicio = datetime.strptime(first['fecha_inicio'], "%d/%m/%y %H:%M")
        
        # Determinar fecha_fin
        if last['fecha_fin'] and last['fecha_fin'].strip():
            # Registro cerrado: usar fecha_fin del último
            fecha_fin = datetime.strptime(last['fecha_fin'], "%d/%m/%y %H:%M")
            is_open = False
        else:
            # Registro abierto: usar fecha actual
            fecha_fin = datetime.now()
            is_open = True
        
        # Calcular diferencia total en minutos
        total_minutos = int((fecha_fin - fecha_inicio).total_seconds() / 60)
        
        # Formatear tiempo
        dias = total_minutos // 1440
        horas = (total_minutos % 1440) // 60
        minutos = total_minutos % 60
        
        if dias > 0:
            return f"{dias}d {horas}h"
        elif total_minutos >= 58 and total_minutos < 120:
            return "1h"
        else:
            if is_open:
                # Abierto: mostrar con minutos
                return f"{horas}h {minutos}m"
            else:
                # Cerrado: solo horas
                return f"{horas}h"

    def get_all_wind_data(self):
        """Obtiene todos los datos de aerogeneradores unidos y separados por planta"""
        falla_data = self.get_aerogeneradores_falla()
        mant_data = self.get_aerogeneradores_mantenimiento()
        
        # Unir ambos arrays
        todos_aeros = falla_data + mant_data
        
        # Detectar y unificar registros continuos
        todos_aeros = self.find_continuous_records(todos_aeros)
        
        # Separar por planta según número de aero
        wayra_i = []
        wayra_ext = []
        
        for aero in todos_aeros:
            # Verificar si es registro unificado
            is_unified = aero.get('is_unified', False)
            
            # Extraer número del nombre (ej: "WTG05*" -> 5, "WTG63" -> 63)
            nombre = aero['nombre'].replace('*', '')  # Remover asterisco para extraer número
            if isinstance(nombre, str) and nombre.startswith('WTG'):
                aero_num = int(nombre.replace('WTG', ''))
                
                # Filtrar STOP y PAUSA con menos de 10 minutos
                if aero['tipo'] in ['STOP', 'PAUSA']:
                    tiempo_str = aero.get('tiempo', '')
                    skip_record = False
                    
                    # Solo verificar si no tiene días ('d' en el string)
                    if 'd' not in tiempo_str:
                        # Extraer minutos y horas
                        horas = 0
                        minutos = 0
                        
                        if 'h' in tiempo_str:
                            # Formato: "Xh Ym" o "Xh"
                            partes = tiempo_str.split()
                            for parte in partes:
                                if 'h' in parte:
                                    horas = int(parte.replace('h', '').strip())
                                elif 'm' in parte:
                                    minutos = int(parte.replace('m', '').strip())
                        else:
                            # Formato: solo "Ym"
                            if 'm' in tiempo_str:
                                try:
                                    minutos = int(tiempo_str.replace('m', '').strip())
                                except:
                                    pass
                        
                        # Calcular total de minutos
                        total_minutos = (horas * 60) + minutos
                        
                        # Si es menor o igual a 10 minutos, saltar
                        if total_minutos <= 10:
                            skip_record = True
                    
                    if skip_record:
                        continue  # Saltar este registro
                
                if aero_num <= 42:
                    wayra_i.append(aero)
                else:
                    wayra_ext.append(aero)
        
        # Ordenar por nombre dentro de cada planta
        # wayra_i.sort(key=lambda x: int(x['nombre'].replace('WTG', '')))
        # wayra_ext.sort(key=lambda x: int(x['nombre'].replace('WTG', '')))
        
        return {
            'wayra_i': wayra_i,
            'wayra_ext': wayra_ext
        }

    def get_daily_report_data(self):
        """Obtiene datos para el reporte diario según los criterios especificados"""
        try:
            # reader = WindDataReader()
            with self.get_connection() as conn:
                
                now = datetime.now()
                current_hour = now.hour
                current_minute = now.minute
                
                # Determinar fecha y hora de referencia (23:45)
                if 8 <= current_hour < 20:
                    # Turno 2 (08:00 - 20:00): consultar estado a las 23:45 del día anterior
                    reference_date = (now.date() - timedelta(days=1))
                elif current_hour >= 20 and (current_hour < 23 or (current_hour == 23 and current_minute < 45)):
                    # Turno 1 entre 20:00 y 23:44: consultar estado a las 23:45 del día anterior
                    reference_date = (now.date() - timedelta(days=1))
                else:
                    # Turno 1 entre 23:45 y 23:59: consultar estado a las 23:45 del día actual
                    reference_date = now.date()
                
                reference_time = time(23, 45, 0)
                reference_datetime = datetime.combine(reference_date, reference_time)
                
                query = """
                SELECT 
                    w.id,
                    w.aero,
                    w.circuito,
                    w.fecha_inicio,
                    w.fecha_fin,
                    w.tipo
                FROM wind_status w
                WHERE 
                    w.fecha_inicio < %s
                    AND (w.fecha_fin IS NULL OR w.fecha_fin > %s)
                ORDER BY w.fecha_inicio ASC
                """
                
                df = pd.read_sql_query(query, conn, params=(reference_datetime, reference_datetime))
                
                # Obtener IDs de registros unificados para excluir componentes
                all_aeros_falla = self.get_aerogeneradores_falla()
                all_aeros_mant = self.get_aerogeneradores_mantenimiento()
                all_data = all_aeros_falla + all_aeros_mant
                unified_data = self.find_continuous_records(all_data)
                
                # Extraer IDs de componentes unificados
                excluded_ids = set()
                for record in unified_data:
                    if record.get('is_unified'):
                        for comp in record['component_records']:
                            excluded_ids.add(comp['id'])
                
                # Formatear datos para la tabla
                report_data = []
                for _, row in df.iterrows():
                    # Excluir componentes de registros unificados
                    if row['id'] in excluded_ids:
                        continue
                    
                    # Extraer número del aero
                    aero_nombre = row['aero']
                    if isinstance(aero_nombre, str) and aero_nombre.startswith('WTG'):
                        aero_num = int(aero_nombre.replace('WTG', ''))
                    else:
                        aero_num = int(aero_nombre)
                    
                    central = "Wayra" if aero_num < 43 else "Wayra Extensión"
                    
                    fecha_inicio = pd.to_datetime(row['fecha_inicio'])
                    
                    # Verificar si el registro estaba activo a las 23:45
                    # Debe cumplir: fecha_inicio < 23:45 y (fecha_fin > 23:45 o fecha_fin es null)
                    if fecha_inicio >= reference_datetime:
                        # Inició después de las 23:45, no mostrar
                        continue
                    
                    fecha_inicio_str = fecha_inicio.strftime("%d/%m/%y %H:%M")
                    
                    # Determinar el estado a las 23:45
                    if pd.notna(row['fecha_fin']) and row['fecha_fin'] is not None:
                        fecha_fin = pd.to_datetime(row['fecha_fin'])
                        if fecha_fin <= reference_datetime:
                            # Terminó antes o en las 23:45, no mostrar
                            continue
                        # Estaba activo a las 23:45 pero finalizó después
                        fecha_fin_str = fecha_fin.strftime("%d/%m/%y %H:%M")
                        estado_actual = "E/S"
                        estado_clase = "status-ok"
                    else:
                        # Sin fecha_fin (sigue activo desde antes de las 23:45)
                        fecha_fin_str = ""
                        estado_actual = "F/S"
                        estado_clase = "status-error"
                    
                    descripcion = "Mantenimiento programado" if row['tipo'] == 'MANT' else ""
                    
                    report_data.append({
                        "central": central,
                        "aero": f"WTG{aero_num:02d}",
                        "circuito": f"C-{str(row['circuito']).zfill(2)}",
                        "hora_inicio": fecha_inicio_str,
                        "descripcion": descripcion,
                        "estado_actual": estado_actual,
                        "estado_clase": estado_clase,
                        "hora_fin": fecha_fin_str
                    })
                
                # Ordenar por central y luego por fecha_inicio
                report_data.sort(key=lambda x: (
                    0 if x['central'] == 'Wayra' else 1,  # Wayra primero
                    x['hora_inicio']  # Luego por fecha_inicio
                ))

                print(f"Datos de reporte diario obtenidos: {len(report_data)} registros")
                return report_data
                
        except Exception as e:
            print(f"Error al obtener datos de reporte diario: {e}")
            import traceback
            traceback.print_exc()
            return []

    def test_connection(self):
        """Prueba la conexión a la base de datos"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM wind_status;")
                count = cursor.fetchone()
                print(f"Conexión exitosa. Registros en wind_status: {count[0]}")
                return True
        except Exception as e:
            print(f"Error al probar la conexión: {e}")
            return False

# Función de conveniencia para uso directo
def get_wind_data():
    """Retorna datos de aerogeneradores para Flask"""
    reader = WindDataReader()
    return reader.get_all_wind_data()

def get_daily_report_data():
    """Retorna datos del reporte diario para Flask"""
    reader = WindDataReader()
    return reader.get_daily_report_data()

if __name__ == "__main__":
    # Prueba del script
    reader = WindDataReader()
    if reader.test_connection():
        data = reader.get_all_wind_data()
        print(f"Aerogeneradores en falla: {len(data['falla'])}")
        print(f"Aerogeneradores en mantenimiento: {len(data['mantenimiento'])}")
    else:
        print("Error en la conexión a base de datos")