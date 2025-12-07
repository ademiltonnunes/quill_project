/**
 * Creates a proxied stream from the source response
 * Passes through all data from AI provider APIs with proper error handling
 * Uses iterative approach to prevent stack overflow on long streams
 */
export function createProxyStream(sourceResponse: Response): ReadableStream {
  if (!sourceResponse.body) {
    throw new Error('Response body is null, cannot create stream');
  }

  const reader = sourceResponse.body.getReader();
  let isCancelled = false;

  return new ReadableStream({
    async start(controller) {
      try {
        while (!isCancelled) {
          const { done, value } = await reader.read();
          
          if (done) {
            controller.close();
            break;
          }
          
          try {
            controller.enqueue(value);
          } catch (enqueueError) {
            // If enqueue fails, the stream might be closed
            try {
              reader.releaseLock();
            } catch {
              // Ignore release errors
            }
            controller.error(enqueueError);
            break;
          }
        }
      } catch (err) {
        // Ensure reader is released on error
        try {
          if (!isCancelled) {
            reader.releaseLock();
          }
        } catch {
          // Ignore release errors
        }
        
        // Only error if controller is still open
        try {
          controller.error(err);
        } catch {
          // Controller might already be closed/errored
        }
      } finally {
        // Final cleanup
        if (!isCancelled) {
          try {
            reader.releaseLock();
          } catch {
            // Ignore release errors
          }
        }
      }
    },
    
    cancel(reason?: any) {
      isCancelled = true;
      try {
        reader.cancel(reason);
      } catch {
        // Ignore cancel errors
      }
      try {
        reader.releaseLock();
      } catch {
        // Ignore release errors
      }
    },
  });
}