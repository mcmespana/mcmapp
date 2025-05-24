// Importa todos los archivos .cho
const files = require.context('./', false, /\.cho$/);

// Crea un objeto con los módulos
const modules = {};
files.keys().forEach(key => {
  modules[key] = files(key);
});

export default modules;