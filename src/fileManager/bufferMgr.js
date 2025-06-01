import { BufferMin, BufferMax, DrainSpeed } from './cfg.js';

class BufferMgr {
    /**
     * 버퍼 관리가 포함된 안전한 전송 메서드
     * @param {RTCDataChannel} channel 데이터 채널
     * @param {ArrayBuffer} data 전송할 데이터
     * @returns {Promise<void>}
     */
    static safeSend(channel, data) {
        return new Promise((resolve, reject) => {
            if (!channel || channel.readyState !== "open") {
                reject(new Error("채널이 준비되지 않음"));
                return;
            }

            const sendChunk = () => {
                // 버퍼가 최대 한도를 초과하면 대기
                if (channel.bufferedAmount > BufferMax) {
                    setTimeout(sendChunk, DrainSpeed);
                    return;
                }

                try {
                    channel.send(data);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            // 버퍼가 최소 한도 이하일 때만 즉시 전송, 아니면 대기
            if (channel.bufferedAmount <= BufferMin) {
                sendChunk();
            } else {
                // bufferedamountlow 이벤트를 활용하여 버퍼가 비워질 때까지 대기
                const onBufferLow = () => {
                    channel.removeEventListener('bufferedamountlow', onBufferLow);
                    sendChunk();
                };

                // 버퍼 임계점 설정
                channel.bufferedAmountLowThreshold = BufferMin;
                channel.addEventListener('bufferedamountlow', onBufferLow);
            }
        });
    }

    /**
     * 채널 초기 설정
     * @param {RTCDataChannel} channel 
     */
    static setupChannel(channel) {
        channel.binaryType = "arraybuffer";
        channel.bufferedAmountLowThreshold = BufferMin;
    }
}

export default BufferMgr;