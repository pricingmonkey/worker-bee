import FastPriorityQueue from 'fastpriorityqueue';

import { OptionalJobQueueOptions, JobQueueOptions } from './queueOptions';

const defaultOptions = <ProcessableMessage, CancelMessage>(): OptionalJobQueueOptions<ProcessableMessage, CancelMessage> => ({
  compare: (a: ProcessableMessage, b: ProcessableMessage) => a < b,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isCancelMessage: (message: ProcessableMessage | CancelMessage): message is CancelMessage => false,
  compactThreshold: Number.MAX_VALUE
});

const DEFAULT_COMPACT_THRESHOLD = 1000;
const internalArray = queue => (queue as any).array;

const shouldBeCancelled =
  <ProcessableMessage extends { timestamp: number }>(
    cancelledContexts: Map<string, number>,
    getContextId: (message: ProcessableMessage) => string,
    message: ProcessableMessage
  ): boolean => {
    const contextId = getContextId(message);
    const cancelContextTimestamp = cancelledContexts.get(contextId);
    return !!(cancelContextTimestamp && cancelContextTimestamp > message.timestamp);
  };

export const makeJobQueue = (setImmediate: (fn: () => any) => void) =>
  <ProcessableMessage extends { timestamp: number }, CancelMessage extends { timestamp: number }>(_options: JobQueueOptions<ProcessableMessage, CancelMessage>) => {
    type Message = ProcessableMessage | CancelMessage;
    const cancelledContexts = new Map<string, number>();

    const options = { ...defaultOptions<ProcessableMessage, CancelMessage>(), ..._options };

    const maxQueueSize = options.compactThreshold || DEFAULT_COMPACT_THRESHOLD;
    const queue = new FastPriorityQueue(options.compare);

    let isProcessing = false;
    return (processMessage: (message: ProcessableMessage) => any, cancelMessage: (message: ProcessableMessage) => any) => (message: Message) => {
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
      if (options.isCancelMessage(message)) {
        if (options.getContextId(message) !== undefined) {
          cancelledContexts.set(options.getContextId(message), message.timestamp);
        } else {
          console.debug('ignoring cancel message with `undefined` contextId: ', JSON.stringify(message));
        }
      } else {
        queue.add(message);
      }
      if (isProcessing) {
        return;
      }
      _exec();
    };
  };
