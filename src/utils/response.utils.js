class ResponseUtils {
  /**
   * Create standardized success response
   * @param {any} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code (default: 200)
   * @returns {Object} - Standardized success response
   */
  static success(data = null, message = "Success", statusCode = 200) {
    return {
      success: true,
      statusCode,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create standardized error response
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {any} details - Additional error details
   * @returns {Object} - Standardized error response
   */
  static error(
    message = "Internal Server Error",
    statusCode = 500,
    details = null
  ) {
    return {
      success: false,
      statusCode,
      message,
      error: details,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create validation error response
   * @param {Array|string} errors - Validation errors
   * @param {string} message - Error message
   * @returns {Object} - Standardized validation error response
   */
  static validationError(errors, message = "Validation Failed") {
    return ResponseUtils.error(message, 400, {
      type: "ValidationError",
      errors: Array.isArray(errors) ? errors : [errors],
    });
  }

  /**
   * Create not found error response
   * @param {string} resource - Resource that was not found
   * @returns {Object} - Standardized not found response
   */
  static notFound(resource = "Resource") {
    return ResponseUtils.error(`${resource} not found`, 404, {
      type: "NotFoundError",
    });
  }

  /**
   * Create unauthorized error response
   * @param {string} message - Unauthorized message
   * @returns {Object} - Standardized unauthorized response
   */
  static unauthorized(message = "Unauthorized access") {
    return ResponseUtils.error(message, 401, {
      type: "UnauthorizedError",
    });
  }

  /**
   * Create forbidden error response
   * @param {string} message - Forbidden message
   * @returns {Object} - Standardized forbidden response
   */
  static forbidden(message = "Access forbidden") {
    return ResponseUtils.error(message, 403, {
      type: "ForbiddenError",
    });
  }

  /**
   * Create too many requests error response
   * @param {string} message - Rate limit message
   * @param {number} retryAfter - Retry after seconds
   * @returns {Object} - Standardized rate limit response
   */
  static tooManyRequests(message = "Too many requests", retryAfter = null) {
    return ResponseUtils.error(message, 429, {
      type: "RateLimitError",
      retryAfter,
    });
  }

  /**
   * Create processing response for long-running operations
   * @param {string} message - Processing message
   * @param {any} data - Additional data (e.g., job ID, progress)
   * @returns {Object} - Standardized processing response
   */
  static processing(message = "Request is being processed", data = null) {
    return ResponseUtils.success(data, message, 202);
  }

  /**
   * Create created response for resource creation
   * @param {any} data - Created resource data
   * @param {string} message - Success message
   * @returns {Object} - Standardized created response
   */
  static created(data, message = "Resource created successfully") {
    return ResponseUtils.success(data, message, 201);
  }

  /**
   * Create no content response
   * @param {string} message - Success message
   * @returns {Object} - Standardized no content response
   */
  static noContent(message = "Operation completed successfully") {
    return ResponseUtils.success(null, message, 204);
  }

  /**
   * Send standardized response to Express response object
   * @param {Object} res - Express response object
   * @param {Object} responseData - Response data from utility methods
   * @returns {Object} - Express response
   */
  static send(res, responseData) {
    return res.status(responseData.statusCode).json(responseData);
  }

  /**
   * Create paginated response
   * @param {Array} data - Array of items
   * @param {number} page - Current page number
   * @param {number} limit - Items per page
   * @param {number} total - Total items count
   * @param {string} message - Success message
   * @returns {Object} - Standardized paginated response
   */
  static paginated(
    data,
    page,
    limit,
    total,
    message = "Data retrieved successfully"
  ) {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return ResponseUtils.success(
      {
        items: data,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNext,
          hasPrev,
          nextPage: hasNext ? page + 1 : null,
          prevPage: hasPrev ? page - 1 : null,
        },
      },
      message
    );
  }

  /**
   * Create file upload success response
   * @param {Array|Object} files - Uploaded file(s) information
   * @param {string} message - Success message
   * @returns {Object} - Standardized file upload response
   */
  static fileUploaded(files, message = "File(s) uploaded successfully") {
    return ResponseUtils.success(
      {
        files: Array.isArray(files) ? files : [files],
        uploadedAt: new Date().toISOString(),
      },
      message,
      201
    );
  }

  /**
   * Create file processing response
   * @param {string} jobId - Processing job ID
   * @param {string} message - Processing message
   * @param {any} additionalData - Additional processing data
   * @returns {Object} - Standardized file processing response
   */
  static fileProcessing(
    jobId,
    message = "File is being processed",
    additionalData = {}
  ) {
    return ResponseUtils.processing(message, {
      jobId,
      status: "processing",
      ...additionalData,
    });
  }

  /**
   * Handle async route errors and send appropriate response
   * @param {Function} asyncFn - Async function to execute
   * @returns {Function} - Express middleware function
   */
  static asyncHandler(asyncFn) {
    return (req, res, next) => {
      Promise.resolve(asyncFn(req, res, next)).catch(next);
    };
  }

  /**
   * Global error handler middleware
   * @param {Error} error - Error object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   * @returns {Object} - Error response
   */
  static globalErrorHandler(error, req, res, next) {
    console.error("Global error handler:", error);

    // Handle specific error types
    if (error.name === "ValidationError") {
      return ResponseUtils.send(
        res,
        ResponseUtils.validationError(error.message)
      );
    }

    if (error.name === "CastError") {
      return ResponseUtils.send(
        res,
        ResponseUtils.validationError("Invalid ID format")
      );
    }

    if (error.code === 11000) {
      return ResponseUtils.send(
        res,
        ResponseUtils.validationError("Duplicate field value")
      );
    }

    if (error.name === "MulterError") {
      if (error.code === "LIMIT_FILE_SIZE") {
        return ResponseUtils.send(
          res,
          ResponseUtils.validationError("File too large")
        );
      }
      if (error.code === "LIMIT_FILE_COUNT") {
        return ResponseUtils.send(
          res,
          ResponseUtils.validationError("Too many files")
        );
      }
      return ResponseUtils.send(
        res,
        ResponseUtils.validationError(`Upload error: ${error.message}`)
      );
    }

    // Default error response
    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    return ResponseUtils.send(
      res,
      ResponseUtils.error(message, statusCode, {
        type: error.name || "UnknownError",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      })
    );
  }
}

module.exports = ResponseUtils;
