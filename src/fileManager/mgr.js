import { ChunkSize } from './cfg.js';
import BufferManager from './bufferMgr.js';
import FileSender from './sender.js';
import FileReceiver from './receiver.js';
import FileMETA from "./fMeta.js";

class FManager {
    constructor() {
        this.chunkSize = ChunkSize;
        this.FILECHANNEL = null;
        this.MSGCHANNEL = null;
        this.emitter = null;

        this.META = new FileMETA(this);
        this.fileSender = null;
        this.fileReceiver = null;
    }

    // 초기화 메서드
    initialize(emitter) {
        this.emitter = emitter;
        this.fileReceiver = new FileReceiver(emitter);
    }

    // 채널 설정
    setFileChannel(channel) {
        this.FILECHANNEL = channel;
        BufferManager.setupChannel(channel);

        if (this.emitter) {
            this.fileSender = new FileSender(channel, this.META, this.emitter);
        }
    }

    listen(channel) {
        this.setFileChannel(channel);
        channel.addEventListener("message", e => this.handleFileReceive(this.META.decodedMeta, e));
    }

    // 파일 전송 메서드 (기존 인터페이스 유지)
    async sendFile(files, progressCallback = () => { }, rsCB = () => { }) {
        if (!this.fileSender) {
            this.emitter?.emit("systemMsg", "❌ 파일 전송기가 초기화되지 않았습니다");
            return;
        }

        return this.fileSender.sendFiles(files, progressCallback, rsCB);
    }

    // 파일 수신 메서드 (기존 인터페이스 유지)
    handleFileReceive(meta, e, progressCallback = () => { }, rsCB = () => { }) {
        if (!this.fileReceiver) {
            this.emitter?.emit("systemMsg", "❌ 파일 수신기가 초기화되지 않았습니다");
            return;
        }
        const onReceiveEnd = m => {
            this.emitter.emit("systemMsg", `✅ 파일 수신 완료: ${m.fileName} (평균 ${m.avgBitrate.formatted})`);
            this.emitter.emit("fileDownloadReady", m);
            this.META.send(m);
        }
        return this.fileReceiver.handleFileReceive(meta, e, progressCallback, onReceiveEnd, rsCB);
    }
}

export default FManager;