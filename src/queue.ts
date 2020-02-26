import FastPriorityQueue from 'fastpriorityqueue';

import { OptionalQueueOptions, QueueOptions } from './queueOptions';

const defaultOptions = <M>(): OptionalQueueOptions<M> => ({
  compare: (a: M, b: M) => a < b,
  shouldCancelMessage: () => false,
  compactThreshold: Number.MAX_VALUE
});

const internalArray = queue => (queue as any).array;

const DEFAULT_COMPACT_THRESHOLD = 1000;
export const makeQueue = (setImmediate: (fn: () => any) => void) => <M>(_options: QueueOptions<M>) => {
  const cancelled = new Set();

  const options = { ...defaultOptions<M>(), ..._options };

  const maxQueueSize = options.compactThreshold || DEFAULT_COMPACT_THRESHOLD;
  const queue = new FastPriorityQueue(options.compare);

  let isProcessing = false;
  return (processMessage: (message: M) => any, cancelMessage: (message: M) => any) => (message: M) => {
    const _exec = () => {
      if (internalArray(queue).length - queue.size > maxQueueSize) {
        queue.trim();
      }
      if (queue.isEmpty()) {
        isProcessing = false;
        return;
      }
      isProcessing = true;
      const message = queue.poll();
      if (message) {
        if (cancelled.has(options.getJobId(message))) {
          cancelMessage(message);
        } else {
          processMessage(message);
        }
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
