import { getVoiceManifest } from "@/actions/admin";
import VoicesClient from "./VoicesClient";

export default async function VoicesPage() {
    const voices = await getVoiceManifest();

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Giọng đọc TTS</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Quản lý danh sách giọng đọc trong manifest. File model (.onnx) cần upload trực tiếp lên R2.
                </p>
            </div>

            <VoicesClient initialVoices={voices} />
        </div>
    );
}
