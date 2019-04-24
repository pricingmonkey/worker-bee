import FastPriorityQueue from 'fastpriorityqueue';

import { OptionalQueueOptions, QueueOptions } from './queueOptions';

const cancelled = new Set();

const defaultOptions = <M>(): OptionalQueueOptions<M> => ({
  compare: (a: M, b: M) => a === b,
  shouldCancelMessage: () => false,
  maxQueueSize: Number.MAX_VALUE
});

const DEFAULT_QUEUE_SIZE = 1000;
export const makeQueue = (setImmediate: (fn: () => any) => void) => <M>(_options: QueueOptions<M>) => {
  const options = { ...defaultOptions(), ..._options };

  const maxQueueSize = options.maxQueueSize || DEFAULT_QUEUE_SIZE;
  const queue: any = new FastPriorityQueue(options.compare);

  let isProcessing = false;
  return (processMessage: (message: M) => any, cancelMessage: (message: M) => any) => (message: M) => {
    const _exec = () => {
      if (queue.array.length - queue.size > maxQueueSize) {
        queue.trim();
      }
      if (queue.isEmpty()) {
        isProcessing = false;
        return;
      }
      isProcessing = true;
      const message = queue.poll();
      if (cancelled.has(options.getJobId(message))) {
        cancelMessage(message);
      } else {
        processMessage(message);
      }
      setImmediate(_exec);
    };
    if (options.shouldCancelMessage(message) && options.getJobId(message) !== undefined) {
      cancelled.add(options.getJobId(message));
    } else {
      queue.add(message);
    }
    if (isProcessing) {
      return;
    }
    _exec();
  };
};
