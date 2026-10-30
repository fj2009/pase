-- Rol de ejecución de la aplicación. No es superusuario y todas las tablas
-- llevan RLS forzado, por lo que el aislamiento se aplica también aquí.
CREATE ROLE pase_app LOGIN PASSWORD 'pase_local_app';
GRANT CONNECT ON DATABASE pase TO pase_app;
