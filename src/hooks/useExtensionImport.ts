import { useEffect, useRef } from 'react';
import {
  APP_MESSAGE_SOURCE,
  parseExtensionMessage,
  parseTriageRequest,
  type AppMessage,
  type CapturedJob,
  type TriageResult,
} from '../../services/extensionProtocol';
import type { JobCardSnapshot } from '../core/matchTypes';

interface Options {
  /** 存储就绪前不收货，否则入库会丢。 */
  ready: boolean;
  /** 收到扩展送来的岗位；去重和入库由调用方在自己的 state updater 里做。 */
  onJobs: (jobs: CapturedJob[]) => void;
  /** 扩展请求给卡片打徽章；不传就不响应（扩展那边会显示「未评分」）。 */
  onTriage?: (cards: JobCardSnapshot[]) => Promise<TriageResult[]>;
}

const post = (message: AppMessage) => window.postMessage(message, window.location.origin);

/**
 * 接浏览器扩展送来的岗位：bridge content script 通过 window.postMessage 发 jobs，
 * 这里交给 onJobs 后回 ack（重复的也 ack，让扩展出队）。扩展发来的粗筛请求交给 onTriage，
 * 结果按 requestId 回给 bridge。页面没装扩展时什么都不会发生。
 */
export const useExtensionImport = ({ ready, onJobs, onTriage }: Options) => {
  const onJobsRef = useRef(onJobs);
  const onTriageRef = useRef(onTriage);
  useEffect(() => {
    onJobsRef.current = onJobs;
    onTriageRef.current = onTriage;
  });

  useEffect(() => {
    if (!ready) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const triage = parseTriageRequest(event.data);
      if (triage) {
        const handler = onTriageRef.current;
        if (!handler) return;
        void handler(triage.cards).then((results) =>
          post({
            source: APP_MESSAGE_SOURCE,
            type: 'triage-result',
            requestId: triage.requestId,
            results,
          }),
        );
        return;
      }
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
