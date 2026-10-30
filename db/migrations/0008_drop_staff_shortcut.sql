-- La función api.create_staff_user de 0003 ya crea la cuenta y la pertenencia
-- con el rol indicado. El atajo de 0007 quedó sin uso y duplicaba el alta.
DROP FUNCTION IF EXISTS api.create_staff_user(uuid, text, text, text);
