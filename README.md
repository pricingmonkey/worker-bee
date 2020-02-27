# 🐝 worker-bee

A simple fast job/task queue for Web Workers.

## What is this?

This library implements a priority based task queuing with cancellation for JavaScript.

Primarily designed for use in Web Workers, but written flexibly to allow use in other contexts (including NodeJS).

Best served with:
 - https://github.com/webpack-contrib/worker-loader
 - https://github.com/yuzujs/setImmediate

## Why?

Web Workers are often advertised as a solution for offloading CPU-intensive work to a separate thread
in order to speed up the computation or avoid freezing UI.

Once you start scaling to hundreds of tasks per second you frequently need more than just the ability to offload them
to a separate thread. Two important features that we identified: 
 - process some tasks faster than others - where processing thousands of tasks, queue build-ups are common,
   and you often can't wait (or make the user wait) for an important task to get it's turn
 - cancel tasks where outputs are no longer required by the user - when user cancels a UI operation it is
   wasteful (and poor UX) to continue processing "orphaned" tasks.

Since Web Workers natively do not offer either priority based message processing or message cancellation
we created this library. 

## Usage

Inside Web Worker:

```typescript
import { makeJobQueue } from 'worker-bee';

type MyMessage = {
  $$type$$: string;
  timestamp: number;
  priority: number;
  contextId: string;
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

const processMessage = (message: MyMessage) => {
  // ... process message ...
  self.postMessage(...); // send response message back to UI thread for handling
};

const cancelMessage = (message: MyMessage) => {
  self.postMessage(...); // send cancel response message back to UI thread for handling
};

const jobQueue = makeJobQueue(require("setimmediate"))(jobQueueOptions);
const onMessage = jobQueue(processMessage, cancelMessage);
self.addEventListener("message", (message) => onMessage(message.data));
``` 

In UI thread:
```typescript
import * as uuid from "uuid";
const worker = new Worker("...");

worker.onmessage = ...;

const contextId = uuid.v4()

// send a few messages with low priority
worker.postMessage({ contextId, timestamp: new Date().getTime(), priority: 5, id: uuid.v4(), ... });
worker.postMessage({ contextId, timestamp: new Date().getTime(), priority: 5, id: uuid.v4(), ... });
worker.postMessage({ contextId, timestamp: new Date().getTime(), priority: 5, id: uuid.v4(), ... });

// one message with very high priority, will be processed in web worker immediately after a task
// that's being currently processed, bypassing other tasks in the queue 
worker.postMessage({ contextId, timestamp: new Date().getTime(), priority: 9, id: uuid.v4(), ... });

// user cancelled request within contextId, stop processing in the web worker, all above messages will stop
worker.postMessage({ contextId, timestamp: new Date().getTime(), $$type$$: "CANCEL" });

// below message will be processed because even though contextId matches, timestamp is fresher than cancellation request
worker.postMessage({ contextId, timestamp: new Date().getTime(), priority: 5, id: uuid.v4(), ... });
```

## License

[Blue Oak Model License](https://blueoakcouncil.org/license/1.0.0)
