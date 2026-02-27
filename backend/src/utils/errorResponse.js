// utils/errorResponse.js

class ErrorResponse extends Error {
  /**
   * Create a new ErrorResponse instance
   * @param {string} message - The error message
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    // Capture the stack trace (excluding the constructor call)
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a 400 Bad Request error
   * @param {string} [message='Bad Request'] - The error message
   * @returns {ErrorResponse}
   */
  static badRequest(message = 'Bad Request') {
    return new ErrorResponse(message, 400);
  }

  /**
   * Create a 401 Unauthorized error
   * @param {string} [message='Unauthorized'] - The error message
   * @returns {ErrorResponse}
   */
  static unauthorized(message = 'Unauthorized') {
    return new ErrorResponse(message, 401);
  }

  /**
   * Create a 403 Forbidden error
   * @param {string} [message='Forbidden'] - The error message
   * @returns {ErrorResponse}
   */
  static forbidden(message = 'Forbidden') {
    return new ErrorResponse(message, 403);
  }

  /**
   * Create a 404 Not Found error
   * @param {string} [message='Not Found'] - The error message
   * @returns {ErrorResponse}
   */
  static notFound(message = 'Not Found') {
    return new ErrorResponse(message, 404);
  }

  /**
   * Create a 500 Internal Server Error
   * @param {string} [message='Internal Server Error'] - The error message
   * @returns {ErrorResponse}
   */
  static serverError(message = 'Internal Server Error') {
    return new ErrorResponse(message, 500);
  }

  /**
   * Create a custom error response
   * @param {string} message - The error message
   * @param {number} statusCode - HTTP status code
   * @returns {ErrorResponse}
   */
  static create(message, statusCode) {
    return new ErrorResponse(message, statusCode);
  }
}

module.exports = ErrorResponse;