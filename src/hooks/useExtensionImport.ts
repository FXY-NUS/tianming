import { useEffect, useRef } from 'react';
import {
  APP_MESSAGE_SOURCE,
  parseExtensionMessage,
  type AppMessage,
  type CapturedJob,
} from '../../services/extensionProtocol';

interface Options {
  /** 存储就绪前不收货，否则入库会丢。 */
  ready: boolean;
  /** 收到扩展送来的岗位；去重和入库由调用方在自己的 state updater 里做。 */
  onJobs: (jobs: CapturedJob[]) => void;
}

const post = (message: AppMessage) => window.postMessage(message, window.location.origin);

/**
 * 接浏览器扩展送来的岗位：bridge content script 通过 window.postMessage 发 jobs，
 * 这里交给 onJobs 后回 ack（重复的也 ack，让扩展出队）。页面没装扩展时什么都不会发生。
 */
export const useExtensionImport = ({ ready, onJobs }: Options) => {
  const onJobsRef = useRef(onJobs);
  useEffect(() => {
    onJobsRef.current = onJobs;
  });

  useEffect(() => {
    if (!ready) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const message = parseExtensionMessage(event.data);
      if (!message || !message.jobs.length) return;
      onJobsRef.current(message.jobs);
      post({
        source: APP_MESSAGE_SOURCE,
        type: 'ack',
        externalIds: message.jobs.map((job) => job.externalId),
      });
    };

    window.addEventListener('message', handleMessage);
    post({ source: APP_MESSAGE_SOURCE, type: 'ready' });
    return () => window.removeEventListener('message', handleMessage);
  }, [ready]);
};
