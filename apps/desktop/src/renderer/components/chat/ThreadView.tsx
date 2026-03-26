import { useSearchParams } from "react-router-dom";
import { ChatView } from "./ChatView";
import { NewThreadView } from "./NewThreadView";

export function ThreadView() {
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get("new") === "true";

  if (isNew) {
    return <NewThreadView />;
  }

  return <ChatView />;
}
