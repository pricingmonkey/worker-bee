import FastPriorityQueue from 'fastpriorityqueue';

import { OptionalJobQueueOptions, JobQueueOptions } from './queueOptions';

const defaultOptions = <M>(): OptionalJobQueueOptions<M> => ({
  compare: (a: M, b: M) => a < b,
  isCancelMessage: () => false,
  compactThreshold: Number.MAX_VALUE
});

const DEFAULT_COMPACT_THRESHOLD = 1000;
const internalArray = queue => (queue as any).array;

const shouldBeCancelled =
  <M extends { timestamp: number }>(
    cancelledContexts: Map<string, number>,
    getContextId: (message: M) => string,
    message: M
  ): boolean => {
    const contextId = getContextId(message);
    const cancelContextTimestamp = cancelledContexts.get(contextId);
    return !!(cancelContextTimestamp && cancelContextTimestamp > message.timestamp);
  };

export const makeJobQueue = (setImmediate: (fn: () => any) => void) =>
  <M extends { timestamp: number }>(_options: JobQueueOptions<M>) => {
    const cancelledContexts = new Map<string, number>();

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
          if (shouldBeCancelled(cancelledContexts, options.getContextId, message)) {
            cancelMessage(message);
          } else {
            processMessage(message);
          }
        }
        setImmediate(_exec);
      };
      if (options.isCancelMessage(message) && options.getContextId(message) !== undefined) {
        cancelledContexts.set(options.getContextId(message), message.timestamp);
      } else {
        queue.add(message);
      }
      if (isProcessing) {
        return;
      }
      _exec();
    };
  };
