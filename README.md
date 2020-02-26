# worker-bee

A simple fast job/task queue for Web Workers.

## What is this?

This library implements a priority based task queuing with cancellation for NodeJS.

Primarily designed for use in Web Workers, but written flexibly to allow use in other contexts.

## Usage

```typescript
  import { makeJobQueue } from 'worker-bee';

  type MyMessage = {
    $$type$$: string;
    timestamp: number;
    priority: number;
    id: string;
  }

  const preferHigherPriorityThenLowerId = (a: { id: number, priority: number }, b: { id: number, priority: number }) =>
    a.priority > b.priority
    || (a.priority === b.priority && a.id < b.id);

  export const jobQueueOptions = {
    getContextId: (message: MyMessage) => message.contextId,
    compare: preferHigherPriorityThenLowerId,
    isCancelMessage: (message: MyMessage) => message.$$type$$ === "CANCEL"
  };

  const _processMessage = (message: MyMessage) => {
    // ... process message ...
    self.postMessage(...); // send response message back to UI thread for handling
  };

  const _cancelMessage = (message: MyMessage) => {
    self.postMessage(...); // send cancel response message back to UI thread for handling
  };

  const _makeJobQueue = makeJobQueue(require("setimmediate"));
  const jobQueue = _makeJobQueue(jobQueueOptions);
  const onMessage = jobQueue(_processMessage, _cancelMessage);
  self.addEventListener("message", (message) => onMessage(message.data));
``` 

## License

Blue Oak Model License