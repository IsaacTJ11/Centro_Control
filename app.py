from flask import Flask, render_template, jsonify, request
import threading
import time
import os
import json
import psycopg2
from lectura_db_solar import get_solar_data
from lectura_db_wind import get_wind_data
from lectura_presa_huinco import PresaHuincoReader
from datetime import datetime

app = Flask(__name__)

def es_error_conexion(e):
    return isinstance(e, (
        psycopg2.OperationalError,
        psycopg2.InterfaceError,
        ConnectionError,
        TimeoutError,
        OSError,
    ))

# Variables globales para cache de datos
wind_data_cache = {
    'data': {'wayra_i': [], 'wayra_ext': []},
    'last_update': None,
    'error': None
}

solar_data_cache = {
    'data': {'rubi': [], 'clemesi': [], 'central': []},
    'last_update': None,
    'error': None
}

def update_wind_data():
    global wind_data_cache
    try:
        print(f"[{datetime.now()}] Actualizando datos de aerogeneradores...")
        wind_data_cache['data'] = get_wind_data()
        wind_data_cache['last_update'] = datetime.now()
        wind_data_cache['error'] = None
        print(f"Datos actualizados: {len(wind_data_cache['data']['wayra_i'])} en Wayra I, {len(wind_data_cache['data']['wayra_ext'])} en Wayra Ext")
    except Exception as e:
        print(f"Error al actualizar datos: {e}")
        wind_data_cache['error'] = e

def update_solar_data():
    global solar_data_cache
    try:
        print(f"[{datetime.now()}] Actualizando datos de inversores solares...")
        solar_data_cache['data'] = get_solar_data()
        solar_data_cache['last_update'] = datetime.now()
        solar_data_cache['error'] = None
        print(f"Solar actualizado: Rubí={len(solar_data_cache['data']['rubi'])}, "
              f"Clemesí={len(solar_data_cache['data']['clemesi'])}, "
              f"Central={len(solar_data_cache['data']['central'])}")
    except Exception as e:
        print(f"Error al actualizar datos solares: {e}")
        solar_data_cache['error'] = e

def background_updater():
    """Ejecuta actualización automática cada 5 minutos"""
    time.sleep(10)
    while True:
        update_wind_data()
        update_solar_data()
        time.sleep(300)

# Iniciar thread de actualización automática
update_thread = threading.Thread(target=background_updater, daemon=True)
update_thread.start()

# Cargar datos iniciales
# update_wind_data()

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/reportes_rer')
def reportes_rer():
    update_wind_data()
    update_solar_data()

    if wind_data_cache['error'] is not None:
        if es_error_conexion(wind_data_cache['error']):
            return render_template('pagina500.html',
                                   error_code=503,
                                   error_detail="Error de conexión con la base de datos de los equipos RER."), 503
        return render_template('pagina500.html',
                               error_code=500,
                               error_detail=str(wind_data_cache['error'])), 500

    wayra_i_data = wind_data_cache['data'].get('wayra_i', [])
    wayra_ext_data = wind_data_cache['data'].get('wayra_ext', [])
    todos = wayra_i_data + wayra_ext_data
    aerogeneradores_falla = [a for a in todos if a.get('tipo') in ['FALLA', 'STOP', 'PAUSA']]
    aerogeneradores_mantenimiento = [a for a in todos if a.get('tipo') == 'MANT']

    solar = solar_data_cache['data']

    return render_template(
        'reportes_rer.html',
        aerogeneradores_falla=aerogeneradores_falla,
        aerogeneradores_mantenimiento=aerogeneradores_mantenimiento,
        last_update=wind_data_cache['last_update'],
        hay_error=wind_data_cache['error'] is not None,
        inversores_rubi=solar.get('rubi', []),
        inversores_clemesi=solar.get('clemesi', []),
        inversores_central=solar.get('central', []),
    )

@app.route('/api/ejecutar-actualizar-wind', methods=['POST'])
def ejecutar_actualizar_wind():
    """Ejecuta el script actualizar_lectura_wind.py"""
    try:
        import subprocess
        import sys
        
        script_path = os.path.join(os.path.dirname(__file__), 'actualizar_lectura_wind.py')
        
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            # Actualizar cache después de ejecutar el script
            update_wind_data()
            return jsonify({
                'status': 'success',
                'message': 'Script ejecutado correctamente'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': f'Error al ejecutar script: {result.stderr}'
            }), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({
            'status': 'error',
            'message': 'El script tardó demasiado tiempo'
        }), 500
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/get-wind-data')
def get_wind_data_api():
    """API para obtener datos de aerogeneradores sin recargar la página"""
    try:
        return jsonify({
            'status': 'success',
            'data': {
                'wayra_i': wind_data_cache['data']['wayra_i'],
                'wayra_ext': wind_data_cache['data']['wayra_ext']
            },
            'last_update': wind_data_cache['last_update'].strftime('%d/%m/%Y %H:%M:%S') if wind_data_cache['last_update'] else None
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/ejecutar-actualizar-solar', methods=['POST'])
def ejecutar_actualizar_solar():
    """Fuerza actualización del cache solar y recarga"""
    try:
        update_solar_data()
        if solar_data_cache['error']:
            return jsonify({'status': 'error', 'message': str(solar_data_cache['error'])}), 500
        return jsonify({'status': 'success', 'message': 'Datos solares actualizados'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/get-solar-data')
def get_solar_data_api():
    """API para obtener datos de inversores solares sin recargar la página"""
    try:
        return jsonify({
            'status': 'success',
            'data': solar_data_cache['data'],
            'last_update': solar_data_cache['last_update'].strftime('%d/%m/%Y %H:%M:%S')
                           if solar_data_cache['last_update'] else None
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/change-solar-equipment-type', methods=['POST'])
def change_solar_equipment_type():
    """Cambia el tipo de un inversor solar (FALLA/MANT)"""
    try:
        data = request.get_json()
        record_id = data.get('id')
        nuevo_tipo = data.get('tipo')

        if not record_id or nuevo_tipo not in ['FALLA', 'MANT']:
            return jsonify({'status': 'error', 'message': 'Datos inválidos'}), 400

        from lectura_db_solar import SolarDataReader
        reader = SolarDataReader()
        with reader.get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(
                "UPDATE public.solar_status SET tipo = %s WHERE id = %s",
                (nuevo_tipo, record_id)
            )
            connection.commit()
            rows_affected = cursor.rowcount
            cursor.close()
            if rows_affected == 0:
                return jsonify({'status': 'error', 'message': f'Registro no encontrado (ID: {record_id})'}), 404

        update_solar_data()
        return jsonify({'status': 'success', 'message': f'Tipo cambiado a {nuevo_tipo}'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/merge-solar-equipment', methods=['POST'])
def merge_solar_equipment():
    """Une dos registros de inversores solares"""
    try:
        data = request.get_json()
        current_id = data.get('current_id')
        next_id = data.get('next_id')
        if not all([current_id, next_id]):
            return jsonify({'status': 'error', 'message': 'Faltan datos'}), 400

        from lectura_db_solar import SolarDataReader
        reader = SolarDataReader()
        with reader.get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(
                "UPDATE public.solar_status SET unido = %s WHERE id = %s",
                (f"{next_id}_M", current_id)
            )
            if cursor.rowcount == 0:
                connection.rollback()
                cursor.close()
                return jsonify({'status': 'error', 'message': f'No se encontró el registro con ID: {current_id}'}), 404
            connection.commit()
            cursor.close()

        update_solar_data()
        return jsonify({'status': 'success', 'message': 'Registros unidos correctamente'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/unmerge-solar-equipment', methods=['POST'])
def unmerge_solar_equipment():
    """Separa registros unidos de inversores solares"""
    try:
        data = request.get_json()
        record_id = data.get('record_id')
        if not record_id:
            return jsonify({'status': 'error', 'message': 'Falta el ID del registro'}), 400

        from lectura_db_solar import SolarDataReader
        import psycopg2.extras
        reader = SolarDataReader()
        with reader.get_connection() as connection:
            cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cursor.execute("SELECT id, unido FROM public.solar_status WHERE id = %s", (record_id,))
            row = cursor.fetchone()
            if not row:
                connection.rollback()
                cursor.close()
                return jsonify({'status': 'error', 'message': 'Registro no encontrado'}), 404

            ids_to_clear = [record_id]
            while row and row['unido'] and str(row['unido']).strip() not in ('', '0', 'ELIMINADO'):
                next_id_str = str(row['unido']).replace('_M', '')
                try:
                    next_id = int(next_id_str)
                except ValueError:
                    break
                ids_to_clear.append(next_id)
                cursor.execute("SELECT id, unido FROM public.solar_status WHERE id = %s", (next_id,))
                row = cursor.fetchone()

            cursor.execute(
                "UPDATE public.solar_status SET unido = 'SEPARADO' WHERE id = ANY(%s)",
                (ids_to_clear,)
            )
            connection.commit()
            cursor.close()

        update_solar_data()
        return jsonify({'status': 'success', 'message': 'Registros separados correctamente'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/update-solar-equipment', methods=['POST'])
def update_solar_equipment():
    """Actualiza fechas y tipo de un registro de inversor solar"""
    try:
        data = request.get_json()
        record_id = data.get('id')
        fecha_inicio_str = data.get('fecha_inicio')
        fecha_fin_str = data.get('fecha_fin')
        tipo = data.get('tipo')

        if not record_id or not fecha_inicio_str:
            return jsonify({'status': 'error', 'message': 'Faltan datos requeridos'}), 400

        try:
            fecha_parts = fecha_inicio_str.split(' ')
            fecha = fecha_parts[0].split('/')
            hora = fecha_parts[1].split(':') if len(fecha_parts) > 1 else ['00', '00']
            fecha_inicio_dt = datetime(int(fecha[2]), int(fecha[1]), int(fecha[0]),
                                       int(hora[0]), int(hora[1]), 0)
        except Exception:
            return jsonify({'status': 'error', 'message': 'Formato de fecha_inicio inválido'}), 400

        fecha_fin_dt = None
        if fecha_fin_str:
            try:
                fecha_parts = fecha_fin_str.split(' ')
                fecha = fecha_parts[0].split('/')
                hora = fecha_parts[1].split(':') if len(fecha_parts) > 1 else ['00', '00']
                fecha_fin_dt = datetime(int(fecha[2]), int(fecha[1]), int(fecha[0]),
                                        int(hora[0]), int(hora[1]), 0)
            except Exception:
                return jsonify({'status': 'error', 'message': 'Formato de fecha_fin inválido'}), 400

        from lectura_db_solar import SolarDataReader
        reader = SolarDataReader()
        with reader.get_connection() as connection:
            cursor = connection.cursor()
            if fecha_fin_dt and tipo:
                cursor.execute(
                    "UPDATE public.solar_status SET fecha_inicio=%s, fecha_fin=%s, tipo=%s WHERE id=%s",
                    (fecha_inicio_dt, fecha_fin_dt, tipo, record_id)
                )
            elif tipo:
                cursor.execute(
                    "UPDATE public.solar_status SET fecha_inicio=%s, tipo=%s WHERE id=%s",
                    (fecha_inicio_dt, tipo, record_id)
                )
            elif fecha_fin_dt:
                cursor.execute(
                    "UPDATE public.solar_status SET fecha_inicio=%s, fecha_fin=%s WHERE id=%s",
                    (fecha_inicio_dt, fecha_fin_dt, record_id)
                )
            else:
                cursor.execute(
                    "UPDATE public.solar_status SET fecha_inicio=%s WHERE id=%s",
                    (fecha_inicio_dt, record_id)
                )
            connection.commit()
            if cursor.rowcount == 0:
                cursor.close()
                return jsonify({'status': 'error', 'message': 'Registro no encontrado'}), 404
            cursor.close()

        update_solar_data()
        return jsonify({'status': 'success', 'message': 'Registro actualizado correctamente'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/mark-deleted-solar-equipment', methods=['POST'])
def mark_deleted_solar_equipment():
    """Marca un registro solar como eliminado"""
    try:
        data = request.get_json()
        record_id = data.get('id')
        if not record_id:
            return jsonify({'status': 'error', 'message': 'ID requerido'}), 400

        from lectura_db_solar import SolarDataReader
        reader = SolarDataReader()
        with reader.get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(
                "UPDATE public.solar_status SET unido = 'ELIMINADO' WHERE id = %s",
                (record_id,)
            )
            connection.commit()
            if cursor.rowcount == 0:
                cursor.close()
                return jsonify({'status': 'error', 'message': 'Registro no encontrado'}), 404
            cursor.close()

        update_solar_data()
        return jsonify({'status': 'success', 'message': 'Registro marcado como eliminado'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/embalse_huinco')
def huinco():
    try:
        reader = PresaHuincoReader()
        with reader.get_connection() as conn:
            pass
        return render_template('presa_huinco.html')
    except Exception as e:
        print(f"Error detectado al cargar /embalse_huinco: {e}")
        error_msg = "No se pudo establecer comunicación con el servidor de la Presa Huinco."
        return render_template('pagina500.html', error_code=503, error_detail=error_msg), 503

@app.route('/api/data-huinco')
def get_data_huinco():
    try:
        reader = PresaHuincoReader()
        actual = reader.get_valores_actuales()
        resultado = reader.get_datos_grafico_con_anotaciones()
        
        return jsonify({
            'status': 'success',
            'actual': actual,
            'grafico': resultado
        })
    except Exception as e:
        if es_error_conexion(e):
            return render_template('pagina500.html', error_code=503, error_detail=str(e)), 503
        raise

@app.route('/api/data-fondo-huinco')
def get_data_fondo_huinco():
    try:
        reader = PresaHuincoReader()
        actual = reader.get_valores_actuales_compuerta_fondo()
        historico = reader.get_historico_compuerta_fondo()

        return jsonify({
            'status': 'success',
            'actual': actual,
            'grafico': historico
        })
    except Exception as e:
        if es_error_conexion(e):
            return jsonify({'status': 'error', 'message': 'Error de conexión con base de datos'}), 503
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/embalse_tulumayo')
def tulumayo():
    return render_template('tulumayo.html')

@app.route('/pulmon_matucana')
def matucana():
    return render_template('matucana.html')

@app.route('/fondo_huinco')
def fondo_huinco():
    try:
        from lectura_presa_huinco import PresaHuincoReader
        reader = PresaHuincoReader()
        with reader.get_connection() as conn:
            pass
        return render_template('fondo_huinco.html')
    except Exception as e:
        print(f"Error de conexión en fondo_huinco: {e}")
        return render_template('pagina500.html',
                               error_code=503,
                               error_detail="Error de comunicación con el sistema de compuertas."), 503

@app.route('/bypass_huinco')
def bypass_huinco():
    return render_template('bypass_huinco.html')

@app.route('/toma_moyopampa')
def toma_moyopampa():
    return render_template('moyopampa.html')

@app.route('/config-compuertas')
def config_compuertas():
    return render_template('config_compuertas.html')

@app.route('/costo-marginal')
def costo_marginal():
    return render_template('costo_marginal.html')

@app.route('/despacho')
def despacho():
    return render_template('despacho.html')

@app.route('/rsf')
def rsf():
    return render_template('rsf.html')

@app.route('/rpf')
def rpf():
    return render_template('rpf.html')

@app.route('/guardar_rpf', methods=['POST'])
def guardar_rpf():
    try:
        data = request.get_json()
        filepath = os.path.join('templates', 'rpf_data.json')
        
        # Crear objeto simple con solo el valor actual
        rpf_data = {
            'rpf_actual': data['rpf_actual'],
            'ultima_actualizacion': data['timestamp']
        }
        
        # Guardar archivo (reemplaza todo el contenido)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(rpf_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'status': 'success',
            'mensaje': 'RPF guardado correctamente'
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'mensaje': str(e)
        }), 500
    
@app.route('/cargar_rpf', methods=['GET'])
def cargar_rpf():
    try:
        filepath = os.path.join('templates', 'rpf_data.json')
        
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return jsonify(data), 200
        else:
            # Si no existe, devolver valor por defecto
            return jsonify({'rpf_actual': 2.90}), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/indis-diaria')
def indis_diaria():
    return render_template('indis_diaria.html')

@app.route('/estado-hydro')
def estado_hydro():
    return render_template('estado_hydro.html')

# ===== MANEJADORES DE ERRORES =====
@app.errorhandler(404)
def page_not_found(e):
    """Maneja páginas no encontradas (rutas inexistentes)"""
    return render_template('pagina404.html'), 404

@app.errorhandler(Exception)
def handle_exception(e):
    from jinja2.exceptions import TemplateNotFound

    if isinstance(e, TemplateNotFound):
        return render_template('pagina404.html'), 404  # sin cambios

    if es_error_conexion(e):
        return render_template('pagina500.html', error_code=503, error_detail=str(e)), 503

    if app.debug:
        raise e

    return render_template('pagina500.html', error_code=500, error_detail=str(e)), 500

@app.errorhandler(503)
def service_unavailable(e):
    return render_template('pagina500.html', error_code=503, error_detail=str(e)), 503

@app.errorhandler(500)
def internal_error(e):
    return render_template('pagina500.html', error_code=500, error_detail=str(e)), 500

@app.route('/api/change-equipment-type', methods=['POST'])
def change_equipment_type():
    """Cambia el tipo de un aerogenerador (FALLA/MANT)"""
    try:
        data = request.get_json()
        record_id = data.get('id')
        nuevo_tipo = data.get('tipo')
        
        if not record_id or not nuevo_tipo or nuevo_tipo not in ['FALLA', 'MANT', 'STOP', 'PAUSA']:
            return jsonify({'status': 'error', 'message': 'Datos inválidos'}), 400
        
        from lectura_db_wind import WindDataReader
        reader = WindDataReader()
        
        with reader.get_connection() as connection:
            cursor = connection.cursor()
            
            # Usar ID para identificar el registro - ES ÚNICO Y PRECISO
            cursor.execute(
                "UPDATE wind_status SET tipo = %s WHERE id = %s",
                (nuevo_tipo, record_id)
            )
            connection.commit()
            
            rows_affected = cursor.rowcount
            cursor.close()
            
            if rows_affected == 0:
                return jsonify({'status': 'error', 'message': f'Registro no encontrado (ID: {record_id})'}), 404
        
        # Actualizar cache
        update_wind_data()
        
        return jsonify({
            'status': 'success',
            'message': f'Tipo cambiado a {nuevo_tipo}',
            'rows_affected': rows_affected
        })
        
    except Exception as e:
        print(f"Error en change_equipment_type: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/merge-equipment', methods=['POST'])
def merge_equipment():
    """Une dos registros estableciendo el ID del siguiente en la columna 'unido'"""
    try:
        data = request.get_json()
        current_id = data.get('current_id')
        next_id = data.get('next_id')
        
        if not all([current_id, next_id]):
            return jsonify({'status': 'error', 'message': 'Faltan datos'}), 400
        
        from lectura_db_wind import WindDataReader
        reader = WindDataReader()
        
        with reader.get_connection() as connection:
            cursor = connection.cursor()
            
            # Actualizar columna 'unido' con el ID del siguiente registro (sufijo _M para manual)
            cursor.execute(
                "UPDATE wind_status SET unido = %s WHERE id = %s",
                (f"{next_id}_M", current_id)
            )
            
            if cursor.rowcount == 0:
                connection.rollback()
                cursor.close()
                return jsonify({'status': 'error', 'message': f'No se encontró el registro con ID: {current_id}'}), 404
            
            connection.commit()
            cursor.close()
        
        # Actualizar cache
        update_wind_data()
        
        return jsonify({
            'status': 'success',
            'message': 'Registros unidos correctamente'
        })
        
    except Exception as e:
        print(f"Error en merge_equipment: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/unmerge-equipment', methods=['POST'])
def unmerge_equipment():
    """Separa registros unidos estableciendo la columna 'unido' en null"""
    try:
        data = request.get_json()
        record_id = data.get('record_id')
        
        if not record_id:
            return jsonify({'status': 'error', 'message': 'Falta el ID del registro'}), 400
        
        from lectura_db_wind import WindDataReader
        import psycopg2.extras
        reader = WindDataReader()
        
        with reader.get_connection() as connection:
            cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            # Recorrer la cadena completa para limpiar todos los punteros 'unido'
            cursor.execute("SELECT id, unido FROM wind_status WHERE id = %s", (record_id,))
            row = cursor.fetchone()
            
            if not row:
                connection.rollback()
                cursor.close()
                return jsonify({'status': 'error', 'message': 'No se encontró el registro indicado'}), 404
            
            ids_to_clear = [record_id]
            
            # Seguir la cadena hacia adelante
            while row and row['unido'] and str(row['unido']).strip() not in ('', '0', 'ELIMINADO'):
                next_id_str = str(row['unido']).replace('_M', '')
                try:
                    next_id = int(next_id_str)
                except ValueError:
                    break
                ids_to_clear.append(next_id)
                cursor.execute("SELECT id, unido FROM wind_status WHERE id = %s", (next_id,))
                row = cursor.fetchone()
            
            # Limpiar unido en todos los registros de la cadena
            cursor.execute(
                "UPDATE wind_status SET unido = 'SEPARADO' WHERE id = ANY(%s)",
                (ids_to_clear,)
            )
            
            connection.commit()
            cursor.close()
        
        update_wind_data()
        
        return jsonify({'status': 'success', 'message': 'Registros separados correctamente'})
        
    except Exception as e:
        print(f"Error en unmerge_equipment: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': 'No se pudo separar los registros. Intente nuevamente.'}), 500

@app.route('/api/update-equipment', methods=['POST'])
def update_equipment():
    """Actualiza fechas y tipo de un registro de aerogenerador"""
    try:
        data = request.get_json()
        record_id = data.get('id')
        fecha_inicio_str = data.get('fecha_inicio')
        fecha_fin_str = data.get('fecha_fin')
        tipo = data.get('tipo')
        
        if not record_id or not fecha_inicio_str:
            return jsonify({'status': 'error', 'message': 'Faltan datos requeridos'}), 400
        
        # Parsear fecha_inicio
        try:
            fecha_parts = fecha_inicio_str.split(' ')
            fecha = fecha_parts[0].split('/')
            hora = fecha_parts[1].split(':') if len(fecha_parts) > 1 else ['00', '00']
            fecha_inicio_dt = datetime(int(fecha[2]), int(fecha[1]), int(fecha[0]), 
                                      int(hora[0]), int(hora[1]), 0)
        except:
            return jsonify({'status': 'error', 'message': 'Formato de fecha_inicio inválido'}), 400
        
        # Parsear fecha_fin si existe
        fecha_fin_dt = None
        if fecha_fin_str:
            try:
                fecha_parts = fecha_fin_str.split(' ')
                fecha = fecha_parts[0].split('/')
                hora = fecha_parts[1].split(':') if len(fecha_parts) > 1 else ['00', '00']
                fecha_fin_dt = datetime(int(fecha[2]), int(fecha[1]), int(fecha[0]), 
                                       int(hora[0]), int(hora[1]), 0)
            except:
                return jsonify({'status': 'error', 'message': 'Formato de fecha_fin inválido'}), 400
        
        from lectura_db_wind import WindDataReader
        reader = WindDataReader()
        
        with reader.get_connection() as connection:
            cursor = connection.cursor()
            
            # Construir query según campos a actualizar
            if fecha_fin_dt and tipo:
                cursor.execute(
                    "UPDATE wind_status SET fecha_inicio = %s, fecha_fin = %s, tipo = %s WHERE id = %s",
                    (fecha_inicio_dt, fecha_fin_dt, tipo, record_id)
                )
            elif tipo:
                cursor.execute(
                    "UPDATE wind_status SET fecha_inicio = %s, tipo = %s WHERE id = %s",
                    (fecha_inicio_dt, tipo, record_id)
                )
            elif fecha_fin_dt:
                cursor.execute(
                    "UPDATE wind_status SET fecha_inicio = %s, fecha_fin = %s WHERE id = %s",
                    (fecha_inicio_dt, fecha_fin_dt, record_id)
                )
            else:
                cursor.execute(
                    "UPDATE wind_status SET fecha_inicio = %s WHERE id = %s",
                    (fecha_inicio_dt, record_id)
                )
            
            connection.commit()
            
            if cursor.rowcount == 0:
                cursor.close()
                return jsonify({'status': 'error', 'message': 'Registro no encontrado'}), 404
            
            cursor.close()
        
        # Actualizar cache
        update_wind_data()
        
        return jsonify({
            'status': 'success',
            'message': 'Registro actualizado correctamente'
        })
        
    except Exception as e:
        print(f"Error en update_equipment: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/mark-deleted-equipment', methods=['POST'])
def mark_deleted_equipment():
    """Marca un registro como eliminado estableciendo 'unido' = 'ELIMINADO'"""
    try:
        data = request.get_json()
        record_id = data.get('id')
        
        if not record_id:
            return jsonify({'status': 'error', 'message': 'ID requerido'}), 400
        
        from lectura_db_wind import WindDataReader
        reader = WindDataReader()
        
        with reader.get_connection() as connection:
            cursor = connection.cursor()
            
            cursor.execute(
                "UPDATE wind_status SET unido = 'ELIMINADO' WHERE id = %s",
                (record_id,)
            )
            connection.commit()
            
            if cursor.rowcount == 0:
                cursor.close()
                return jsonify({'status': 'error', 'message': 'Registro no encontrado'}), 404
            
            cursor.close()
        
        # Actualizar cache
        update_wind_data()
        
        return jsonify({
            'status': 'success',
            'message': 'Registro marcado como eliminado correctamente'
        })
        
    except Exception as e:
        print(f"Error en mark_deleted_equipment: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/daily-report-data')
def daily_report_data():
    """API para obtener datos del reporte diario"""
    try:
        # Actualizar datos antes de obtener el reporte
        update_wind_data()
        
        from lectura_db_wind import get_daily_report_data
        data = get_daily_report_data()
        return jsonify({
            'status': 'success',
            'data': data
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error al obtener datos: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)