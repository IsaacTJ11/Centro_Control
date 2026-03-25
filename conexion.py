import psycopg2

try:
    connection = psycopg2.connect(
        host= 'localhost',
        user= 'postgres',
        password= 'admin',
        database= 'centrocontrolDB'
    )

    print("Conexion exitosa")
except Exception as ex:
    print(ex)