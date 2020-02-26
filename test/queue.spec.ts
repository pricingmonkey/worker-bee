import * as chai from 'chai';
import { It, Mock, Times, ExpectedCallType } from 'typemoq';

import { makeQueue } from '../src';
import { QueueOptions } from '../src/queueOptions';

chai.config.truncateThreshold = 0;
chai.config.includeStack = true;

const callFnSynchronously = fn => fn();
type Message = { id: string, type?: string };

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
    let options: QueueOptions<Message> = { getJobId: (message) => message.id };
    const queueMaker = makeQueue(callFnSynchronously)(options);

    const processMessageMock = Mock.ofType<(m: Message) => any>();
    const cancelMessageMock = Mock.ofType<(m: Message) => any>();

    const queue = queueMaker(processMessageMock.object, cancelMessageMock.object);

    queue({ id: '1' });

    processMessageMock.verify(f => f({ id: '1' }), Times.once());
  });

  it('should cancel message', async () => {
    let options: QueueOptions<Message> = {
      getJobId: (message) => message.id,
      shouldCancelMessage: (message) => message.type === 'cancel'
    };
    const queueMaker = makeQueue(process.nextTick)(options);

    const processMessageMock = Mock.ofType<(m: Message) => any>();
    const cancelMessageMock = Mock.ofType<(m: Message) => any>();

    const queue = queueMaker(processMessageMock.object, cancelMessageMock.object);

    queue({ id: '1' });
    queue({ id: '2' });
    queue({ id: '2', type: 'cancel' });

    return delay(() => {
      cancelMessageMock.verify(f => f(It.isObjectWith({ id: '2' })), Times.once());
    }, 0);
  });

  it('should process in order from lowest number to highest', async () => {
    let LOWER_ID_HAS_HIGHER_PRIORITY = (a, b) => a.id < b.id;
    let options: QueueOptions<Message> = {
      getJobId: (message) => message.id,
      compare: LOWER_ID_HAS_HIGHER_PRIORITY
    };
    const queueMaker = makeQueue(process.nextTick)(options);

    const processMessageMock = Mock.ofType<(m: Message) => any>();
    const cancelMessageMock = Mock.ofType<(m: Message) => any>();

    // processed first because nothing in the queue
    processMessageMock.setup(f => f({ id: '3' })).verifiable(Times.once(), ExpectedCallType.InSequence);
    // while 3 is being processed, 2 and 1 were added, in the next tick 1 is processed first as a lower number
    processMessageMock.setup(f => f({ id: '1' })).verifiable(Times.once(), ExpectedCallType.InSequence);
    // 2 is processed last
    processMessageMock.setup(f => f({ id: '2' })).verifiable(Times.once(), ExpectedCallType.InSequence);
    const queue = queueMaker(processMessageMock.object, cancelMessageMock.object);

    queue({ id: '3' });
    queue({ id: '2' });
    queue({ id: '1' });

    return delay(() => {
      processMessageMock.verifyAll();
    }, 0);
  });
});
