import { seed } from "./migrate.mjs";

seed()
  .then(() => console.log("Datos de demostración cargados."))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
