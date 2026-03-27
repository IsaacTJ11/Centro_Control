from lectura_db_wind import WindDataReader
import pandas as pd
from datetime import datetime, timedelta
import numpy as np

class PresaHuincoReader(WindDataReader):
    # Dentro de tu clase en lectura_presa_huinco.py
    def get_datos_grafico(self):
        try:
            with self.get_connection() as conn:
                hoy = datetime.now().date()
                mañana = hoy + timedelta(days=1)
                
                query = """
                SELECT fecha, caudal_entrada, caudal_turbinado, caudal_callahuanca, 
                    caudal_descarga, nivel_presa, volumen_presa 
                FROM public.presa_huinco 
                WHERE fecha >= %s AND fecha < %s
                ORDER BY fecha ASC
                """
                df = pd.read_sql_query(query, conn, params=[hoy, mañana])
                
                df = df.replace({np.nan: None})
                df = df.where(pd.notnull(df), None)
                
                df['fecha'] = df['fecha'].dt.strftime('%Y-%m-%dT%H:%M:%S')
                return df.to_dict(orient='records')
        except Exception as e:
            print(f"Error: {e}")
            return []

    def get_valores_actuales(self):
        """Obtiene el último registro con caudal_entrada no null"""
        try:
            with self.get_connection() as conn:
                query = """
                    SELECT * FROM public.presa_huinco 
                    WHERE caudal_entrada IS NOT NULL 
                    ORDER BY fecha DESC 
                    LIMIT 1
                """
                df = pd.read_sql_query(query, conn)
                if not df.empty:
                    data = df.iloc[0].to_dict()
                    if isinstance(data['fecha'], datetime):
                        data['fecha'] = data['fecha'].strftime('%Y-%m-%d %H:%M:%S')
                    return data
                return None
        except Exception as e:
            print(f"Error valores actuales: {e}")
            return None

    def get_datos_grafico_con_anotaciones(self):
        """Obtiene datos del gráfico más información para anotaciones"""
        try:
            with self.get_connection() as conn:
                hoy = datetime.now().date()
                mañana = hoy + timedelta(days=1)
                
                # Consulta principal
                query = """
                    WITH primer_dato AS (
                        SELECT MIN(fecha) as fecha_inicio
                        FROM public.presa_huinco
                        WHERE caudal_entrada IS NOT NULL
                    )
                    SELECT fecha, caudal_entrada, caudal_turbinado, caudal_callahuanca, 
                        caudal_descarga, nivel_presa, volumen_presa 
                    FROM public.presa_huinco 
                    WHERE fecha >= (SELECT fecha_inicio FROM primer_dato)
                    ORDER BY fecha ASC
                """
                df = pd.read_sql_query(query, conn)
                
                # Datos básicos
                df = df.replace({np.nan: None})
                df['fecha'] = df['fecha'].dt.strftime('%Y-%m-%dT%H:%M:%S')
                datos = df.to_dict(orient='records')
                
                # Calcular anotaciones
                anotaciones = self._calcular_anotaciones(df)
                
                return {
                    'datos': datos,
                    'anotaciones': anotaciones
                }
        except Exception as e:
            print(f"Error: {e}")
            return {'datos': [], 'anotaciones': {}}

    def _calcular_anotaciones(self, df):
        """Calcula las anotaciones para el gráfico"""
        anotaciones = {
            'yaxis': [
                {'y': 1868, 'label': 'N. Máx.'},
                {'y': 1858, 'label': 'N. Mín.'}
            ],
            'xaxis': [],
            'points': []
        }
        
        # Encontrar fecha_inicio_futuro (primer registro sin caudal_entrada)
        df_sin_entrada = df[df['caudal_entrada'].isna()]

        if not df_sin_entrada.empty:
            fecha_inicio = df.iloc[df_sin_entrada.index[0] - 1]['fecha']
            fecha_fin = df.iloc[-1]['fecha']
            
            anotaciones['xaxis'].append({
                'fecha_inicio': fecha_inicio,
                'fecha_fin': fecha_fin,
                'label': 'Proyección'
            })
        
        # Calcular puntos de cambio en caudal_descarga
        caudal_anterior = None
        ultima_fecha_punto = None
        posicion_alternada = 'top'

        for idx, row in df.iterrows():
            if pd.notna(row['caudal_descarga']):
                if caudal_anterior is not None:
                    diferencia = abs(row['caudal_descarga'] - caudal_anterior)
                    
                    # Si hay cambio > 1 m3/s
                    if diferencia > 1:
                        fecha_actual = pd.to_datetime(row['fecha'])
                        
                        # Determinar tolerancia según magnitud del cambio
                        if diferencia >= 4:
                            # Para cambios grandes (≥4 m3/s): permitir aparición continua cada 30 min
                            tolerancia_tiempo = 1800  # 30 minutos
                        else:
                            # Para cambios pequeños (1-3.99 m3/s): verificar si hay cambio en próximos 30 min
                            proximo_idx = idx + 1 if idx + 1 < len(df) else None
                            hay_cambio_siguiente = False
                            
                            if proximo_idx is not None:
                                proximo_row = df.iloc[proximo_idx]
                                if pd.notna(proximo_row['caudal_descarga']):
                                    fecha_proxima = pd.to_datetime(proximo_row['fecha'])
                                    diferencia_tiempo = (fecha_proxima - fecha_actual).total_seconds()
                                    diferencia_caudal = abs(proximo_row['caudal_descarga'] - row['caudal_descarga'])
                                    
                                    if diferencia_tiempo <= 1800 and diferencia_caudal > 1:
                                        hay_cambio_siguiente = True
                            
                            # Si hay cambio siguiente, saltar este punto
                            if hay_cambio_siguiente:
                                caudal_anterior = row['caudal_descarga']
                                continue
                            
                            tolerancia_tiempo = 3600  # 1 hora entre puntos
                        
                        # Verificar tolerancia de tiempo
                        if ultima_fecha_punto is None or \
                        (fecha_actual - ultima_fecha_punto).total_seconds() >= tolerancia_tiempo:
                            
                            anotaciones['points'].append({
                                'fecha': row['fecha'],
                                'y': row['nivel_presa'] if pd.notna(row['nivel_presa']) else 1860,
                                'caudal': round(row['caudal_descarga'], 2),
                                'position': posicion_alternada
                            })
                            ultima_fecha_punto = fecha_actual
                            posicion_alternada = 'bottom' if posicion_alternada == 'top' else 'top'
                
                caudal_anterior = row['caudal_descarga']
        
        return anotaciones

    def get_valores_actuales_compuerta_fondo(self):
        """Obtiene el último registro de apertura y caudal de la compuerta de fondo Huinco"""
        try:
            with self.get_connection() as conn:
                query = """
                    SELECT fecha, apertura, caudal, nivel_embalse
                    FROM public.compuerta_fondo_huinco
                    WHERE apertura IS NOT NULL
                    ORDER BY fecha DESC
                    LIMIT 1
                """
                df = pd.read_sql_query(query, conn)
                if not df.empty:
                    data = df.iloc[0].to_dict()
                    if isinstance(data.get('fecha'), datetime):
                        data['fecha'] = data['fecha'].strftime('%Y-%m-%d %H:%M:%S')
                    # Convertir NaN a None
                    for k, v in data.items():
                        if pd.isna(v) if not isinstance(v, str) else False:
                            data[k] = None
                    return data
                return None
        except Exception as e:
            print(f"Error get_valores_actuales_compuerta_fondo: {e}")
            return None

    def get_historico_compuerta_fondo(self):
        """Obtiene el histórico de apertura/caudal de la compuerta de fondo del día actual"""
        try:
            with self.get_connection() as conn:
                hoy = datetime.now().date()
                manana = hoy + timedelta(days=1)
                query = """
                    SELECT fecha, apertura, caudal, nivel_embalse
                    FROM public.compuerta_fondo_huinco
                    WHERE fecha >= %s AND fecha < %s
                    ORDER BY fecha ASC
                """
                df = pd.read_sql_query(query, conn, params=[hoy, manana])
                df = df.replace({np.nan: None})
                df['fecha'] = df['fecha'].dt.strftime('%Y-%m-%dT%H:%M:%S')
                return df.to_dict(orient='records')
        except Exception as e:
            print(f"Error get_historico_compuerta_fondo: {e}")
            return []