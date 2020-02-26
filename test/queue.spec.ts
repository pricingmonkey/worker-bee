import * as chai from 'chai';
import { It, Mock, Times, ExpectedCallType } from 'typemoq';

import { makeJobQueue } from '../src';
import { JobQueueOptions } from '../src/queueOptions';

chai.config.truncateThreshold = 0;
chai.config.includeStack = true;

const callFnSynchronously = fn => fn();
type Message = { timestamp: number, id: string, type?: string };
type ContextMessage = { timestamp: number, contextId: string, type?: string };

const delay = async (callback: () => void, delayInMs: number) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(callback());
      } catch (e) {
        reject(e);
      }
    }, delayInMs);
  });
};

describe('queue', () => {
  it('should process message', () => {
    let options: JobQueueOptions<Message> = { getContextId: (message) => message.id };
    const queueMaker = makeJobQueue(callFnSynchronously)(options);

    const processMessageMock = Mock.ofType<(m: Message) => any>();
    const cancelMessageMock = Mock.ofType<(m: Message) => any>();

    const queue = queueMaker(processMessageMock.object, cancelMessageMock.object);

    queue({ id: '1', timestamp: 0 });

    processMessageMock.verify(f => f({ id: '1', timestamp: 0 }), Times.once());
  });

  it('should cancel message', async () => {
    let options: JobQueueOptions<Message> = {
      getContextId: (message) => message.id,
      isCancelMessage: (message) => message.type === 'cancel'
    };
    const queueMaker = makeJobQueue(process.nextTick)(options);

    const processMessageMock = Mock.ofType<(m: Message) => any>();
    const cancelMessageMock = Mock.ofType<(m: Message) => any>();

    const queue = queueMaker(processMessageMock.object, cancelMessageMock.object);

    queue({ id: '1', timestamp: 0 });
    queue({ id: '2', timestamp: 0 });
    queue({ id: '2', type: 'cancel', timestamp: 1 });

    return delay(() => {
      cancelMessageMock.verify(f => f(It.isObjectWith({ id: '2', timestamp: 0 })), Times.once());
    }, 0);
  });

  it('should cancel all messages within context before cancellation timestamp', async () => {
    let options: JobQueueOptions<ContextMessage> = {
      getContextId: (message) => message.contextId,
      isCancelMessage: (message) => message.type === 'cancel'
    };
    const queueMaker = makeJobQueue(process.nextTick)(options);

    const processMessageMock = Mock.ofType<(m: ContextMessage) => any>();
    const cancelMessageMock = Mock.ofType<(m: ContextMessage) => any>();

    const queue = queueMaker(processMessageMock.object, cancelMessageMock.object);

    queue({ contextId: '1', timestamp: 0 });
    queue({ contextId: '2', timestamp: 0 });
    queue({ contextId: '2', timestamp: 5 });
    queue({ contextId: '2', timestamp: 10 });
    queue({ contextId: '2', type: 'cancel', timestamp: 9 });

    return delay(() => {
      processMessageMock.verify(f => f(It.isObjectWith({ contextId: '1', timestamp: 0 })), Times.once());
      processMessageMock.verify(f => f(It.isObjectWith({ contextId: '2', timestamp: 10 })), Times.once());

      cancelMessageMock.verify(f => f(It.isObjectWith({ contextId: '2', timestamp: 0 })), Times.once());
      cancelMessageMock.verify(f => f(It.isObjectWith({ contextId: '2', timestamp: 5 })), Times.once());
    }, 0);
  });

  it('should process in order from lowest number to highest', async () => {
    let LOWER_ID_HAS_HIGHER_PRIORITY = (a, b) => a.id < b.id;
    let options: JobQueueOptions<Message> = {
      getContextId: (message) => message.id,
      compare: LOWER_ID_HAS_HIGHER_PRIORITY
    };
    const queueMaker = makeJobQueue(process.nextTick)(options);

    const processMessageMock = Mock.ofType<(m: Message) => any>();
    const cancelMessageMock = Mock.ofType<(m: Message) => any>();

    // processed first because nothing in the queue
    processMessageMock.setup(f => f({ id: '3', timestamp: 0 }))
      .verifiable(Times.once(), ExpectedCallType.InSequence);
    // while 3 is being processed, 2 and 1 were added, in the next tick 1 is processed first as a lower number
    processMessageMock.setup(f => f({ id: '1', timestamp: 0 }))
      .verifiable(Times.once(), ExpectedCallType.InSequence);
    // 2 is processed last
    processMessageMock.setup(f => f({ id: '2', timestamp: 0 }))
      .verifiable(Times.once(), ExpectedCallType.InSequence);
    const queue = queueMaker(processMessageMock.object, cancelMessageMock.object);

    queue({ id: '3', timestamp: 0 });
    queue({ id: '2', timestamp: 0 });
    queue({ id: '1', timestamp: 0 });

    return delay(() => {
      processMessageMock.verifyAll();
    }, 0);
  });
});
