class BitrateCalculator {
    /**
     * 바이트를 적절한 단위로 포맷팅
     * @param {number} bytes 바이트 수
     * @returns {Object} {value: number, unit: string}
     */
    static formatBytes(bytes) {
        if (bytes === 0) return { value: 0, unit: 'B' };
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
        
        return { value, unit: units[i] };
    }

    /**
     * 비트레이트 계산 및 포맷팅
     * @param {number} bytes 전송된 바이트
     * @param {number} startTime 시작 시간
     * @param {number} currentTime 현재 시간
     * @returns {Object} {value: number, unit: string, formatted: string}
     */
    static calculateBitrate(bytes, startTime, currentTime) {
        const timeElapsed = (currentTime - startTime) / 1000; // 초 단위
        if (timeElapsed <= 0) return { value: 0, unit: 'B/s', formatted: '0 B/s' };
        
        const bytesPerSecond = bytes / timeElapsed;
        const formatted = this.formatBytes(bytesPerSecond);
        
        return {
            value: formatted.value,
            unit: `${formatted.unit}/s`,
            formatted: `${formatted.value} ${formatted.unit}/s`
        };
    }

    /**
     * 순간 비트레이트 계산 및 포맷팅
     * @param {number} currentBytes 현재까지 전송된 바이트
     * @param {number} lastBytes 이전에 전송된 바이트
     * @param {number} currentTime 현재 시간
     * @param {number} lastTime 이전 시간
     * @returns {Object} {value: number, unit: string, formatted: string}
     */
    static calculateInstantBitrate(currentBytes, lastBytes, currentTime, lastTime) {
        const timeElapsed = (currentTime - lastTime) / 1000; // 초 단위
        const bytesTransferred = currentBytes - lastBytes;
        
        if (timeElapsed <= 0) return { value: 0, unit: 'B/s', formatted: '0 B/s' };
        
        const bytesPerSecond = bytesTransferred / timeElapsed;
        const formatted = this.formatBytes(bytesPerSecond);
        
        return {
            value: formatted.value,
            unit: `${formatted.unit}/s`,
            formatted: `${formatted.value} ${formatted.unit}/s`
        };
    }

    // 기존 호환성을 위한 레거시 메서드들 (숫자만 반환)
    static calculateBitrateValue(bytes, startTime, currentTime) {
        const result = this.calculateBitrate(bytes, startTime, currentTime);
        return result.value;
    }

    static calculateInstantBitrateValue(currentBytes, lastBytes, currentTime, lastTime) {
        const result = this.calculateInstantBitrate(currentBytes, lastBytes, currentTime, lastTime);
        return result.value;
    }
}

export default BitrateCalculator;