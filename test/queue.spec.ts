import * as chai from 'chai';
import { Mock, Times } from 'typemoq';

import { makeQueue } from '../src';
import { QueueOptions } from '../src/queueOptions';

chai.config.truncateThreshold = 0;
chai.config.includeStack = true;

const callFnSynchronously = fn => fn();
type Message = { id: string };
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

  it('should cancel message', () => {
    let options: QueueOptions<Message> = {
      getJobId: (message) => message.id,
      shouldCancelMessage: () => true
    };
    const setImmediateMock = Mock.ofType<() => void>();
    setImmediateMock.setup(f => f)
    const queueMaker = makeQueue(setImmediateMock.object)(options);

    const processMessageMock = Mock.ofType<(m: Message) => any>();
    const cancelMessageMock = Mock.ofType<(m: Message) => any>();

    const queue = queueMaker(processMessageMock.object, cancelMessageMock.object);

    queue({ id: '1' });

    cancelMessageMock.verify(f => f({ id: '1' }), Times.once());
  });
});
