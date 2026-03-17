import { getNextChapterIndex } from "@/actions/admin";
import CreateChapterForm from "./CreateChapterForm";

export default async function CreateChapterPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const nextIndex = await getNextChapterIndex(id);

    return <CreateChapterForm storyId={id} defaultIndex={nextIndex} />;
}
