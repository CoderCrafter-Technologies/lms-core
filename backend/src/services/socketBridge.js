let socketHandlerInstance = null;

const setSocketHandler = (handler) => {
  socketHandlerInstance = handler;
};

const getSocketHandler = () => socketHandlerInstance;

module.exports = {
  setSocketHandler,
  getSocketHandler
};
