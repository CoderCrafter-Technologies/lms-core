const cron = require('node-cron');
const classRepository = require("../repositories/LiveClassRepository");

module.exports = cron.schedule('* * * * *', () => {
  console.log('Running a task every minute');
  // Your task logic here
  



});