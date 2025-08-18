class ResponseUtils {
  static success(data = null, message = "Success", statusCode = 200) {
    return {
      success: true,
      statusCode,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

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

  static validationError(errors, message = "Validation Failed") {
    return ResponseUtils.error(message, 400, {
      type: "ValidationError",
      errors: Array.isArray(errors) ? errors : [errors],
    });
  }

  static notFound(resource = "Resource") {
    return ResponseUtils.error(`${resource} not found`, 404, {
      type: "NotFoundError",
    });
  }

  static unauthorized(message = "Unauthorized access") {
    return ResponseUtils.error(message, 401, {
      type: "UnauthorizedError",
    });
  }

  static forbidden(message = "Access forbidden") {
    return ResponseUtils.error(message, 403, {
      type: "ForbiddenError",
    });
  }

  static tooManyRequests(message = "Too many requests", retryAfter = null) {
    return ResponseUtils.error(message, 429, {
      type: "RateLimitError",
      retryAfter,
    });
  }

  static processing(message = "Request is being processed", data = null) {
    return ResponseUtils.success(data, message, 202);
  }

  static created(data, message = "Resource created successfully") {
    return ResponseUtils.success(data, message, 201);
  }

  static noContent(message = "Operation completed successfully") {
    return ResponseUtils.success(null, message, 204);
  }

  static send(res, responseData) {
    return res.status(responseData.statusCode).json(responseData);
  }

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

  static asyncHandler(asyncFn) {
    return (req, res, next) => {
      Promise.resolve(asyncFn(req, res, next)).catch(next);
    };
  }

  static globalErrorHandler(error, req, res, next) {
    console.error("Global error handler:", error);

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
