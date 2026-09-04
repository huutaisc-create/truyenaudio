import { getNextChapterIndex } from "@/actions/admin";
import AddChapterTabs from "./AddChapterTabs";

export default async function CreateChapterPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const nextIndex = await getNextChapterIndex(id);

    return <AddChapterTabs storyId={id} defaultIndex={nextIndex} />;
}
