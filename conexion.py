<<<<<<< HEAD
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
=======
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
>>>>>>> d8ad0b27ff8876c3ce36c1e1edf5e1db272e0c05
    print(ex)