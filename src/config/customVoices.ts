export interface CustomVoice {
    id: string;
    name: string;
    path: string; // Relative path from public/models/custom, without extension
    description?: string;
}

export const CUSTOM_VOICES: CustomVoice[] = [
    // Example custom voice (uncomment and edit when you have files)
    // {
    //   id: 'my-custom-voice-1',
    //   name: 'Giọng Đọc Riêng 1',
    //   path: 'giong_nam_1', // Expects public/models/custom/giong_nam_1.onnx and .json
    //   description: 'Giọng nam trầm'
    // },
];
