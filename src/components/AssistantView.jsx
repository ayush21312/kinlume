import { responseJson } from "../utils/responseJson.js";
import LoadingIndicator from "./LoadingIndicator.jsx";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import VisitPlanner from "./VisitPlanner.jsx";

export default function AssistantView({
  resources,
  location,
  onResources,
  onSelect,
  messages,
  onMessagesChange,
  mode,
  onModeChange,
  plannerProfile,
  onPlannerProfileChange,
  visitPlan,
  onVisitPlanChange,
  savedIds,
  onToggleSave,
}) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [discussingPlan, setDiscussingPlan] = useState(false);
  const [error, setError] = useState("");
  const transcript = useRef(null);

  useEffect(() => {
    // Scroll only messages. Scrolling a child into view can move the whole app.
    const panel = transcript.current;
    panel?.scrollTo({ top: panel.scrollHeight, behavior: "auto" });
  }, [messages, busy]);

  async function sendMessage(
    event,
    suggestedQuestion,
    attachPlan = discussingPlan,
  ) {
    event?.preventDefault();
    const text = (suggestedQuestion || question).trim();
    if (!text || busy) return;
    const nextMessages = [...messages, { role: "user", text }];
    onMessagesChange(nextMessages);
    setQuestion("");
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(85000),
        body: JSON.stringify({
          profile: { city: plannerProfile?.location || location },
          // Saving a survey does not turn every chat message into a visit-plan request.
          planProfile: attachPlan ? plannerProfile : null,
          messages: nextMessages
            .slice(-10)
            .map(({ role, text }) => ({ role, text })),
        }),
      });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data.error || "Unable to get a reply.");
      onResources(data.resources || []);
      onMessagesChange([
        ...nextMessages,
        {
          role: "assistant",
          text: data.answer,
          steps: data.steps,
          resourceIds: data.resourceIds,
          resources: data.resources || [],
          engine: data.engine,
        },
      ]);
    } catch (failure) {
      setError(
        failure.name === "TimeoutError"
          ? "The search took too long. Please try again."
          : failure.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="assistant-chat" aria-label="Assistant chat">
      <div className="chat-heading">
        <h1>{mode === "plan" ? "Visit planner" : "Assistant"}</h1>
        {mode === "chat" && messages.length > 0 && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              onMessagesChange([]);
              setDiscussingPlan(false);
              setError("");
            }}
          >
            New chat
          </button>
        )}
      </div>
      <div className="assistant-modes" role="group" aria-label="Assistant mode">
        <button
          aria-pressed={mode === "chat"}
          onClick={() => onModeChange("chat")}
        >
          Chat
        </button>
        <button
          aria-pressed={mode === "plan"}
          onClick={() => onModeChange("plan")}
        >
          Plan a visit
        </button>
      </div>
      {mode === "plan" ? (
        <VisitPlanner
          location={location}
          profile={plannerProfile}
          onProfileChange={onPlannerProfileChange}
          plan={visitPlan}
          onPlanChange={onVisitPlanChange}
          onResources={onResources}
          onSelect={onSelect}
          savedIds={savedIds}
          onToggleSave={onToggleSave}
          onDiscuss={() => {
            onModeChange("chat");
            setDiscussingPlan(true);
            sendMessage(
              null,
              "Explain my visit options and the most important next step using my visit preferences.",
              true,
            );
          }}
        />
      ) : (
        <>
          {plannerProfile && discussingPlan && (
            <div className="attached-preferences">
              Visit preferences{" "}
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setDiscussingPlan(false);
                  onPlannerProfileChange(null);
                  onVisitPlanChange(null);
                }}
              >
                Clear
              </button>
            </div>
          )}
          <div
            className="chat-transcript"
            ref={transcript}
            role="log"
            aria-label="Conversation"
            aria-live="polite"
          >
            {!messages.length && (
              <div className="chat-welcome">
                <p>How can I help?</p>
                <div className="chat-suggestions">
                  {[
                    "Find food",
                    "Explore programs",
                    "Find volunteer opportunities",
                  ].map((text) => (
                    <button key={text} onClick={() => sendMessage(null, text)}>
                      <Icon
                        name={
                          text === "Find food"
                            ? "food"
                            : text === "Explore programs"
                              ? "programs"
                              : "donate"
                        }
                        size={20}
                      />
                      <span>{text}</span>
                      <Icon name="arrow" size={18} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <article className={`chat-message ${message.role}`} key={index}>
                <span className="sr-only">
                  {message.role === "user" ? "You" : "Assistant"}:{" "}
                </span>
                <p>{message.text}</p>
                {message.steps?.length > 0 && (
                  <ol>
                    {message.steps.map((step, stepIndex) => (
                      <li key={stepIndex}>{step}</li>
                    ))}
                  </ol>
                )}
                {message.resourceIds?.length > 0 && (
                  <div className="chat-listings">
                    {message.resourceIds
                      .map(
                        (id) =>
                          resources.find((resource) => resource.id === id) ||
                          message.resources?.find(
                            (resource) => resource.id === id,
                          ),
                      )
                      .filter(Boolean)
                      .map((resource) => (
                        <button
                          key={resource.id}
                          className="chat-listing"
                          onClick={() => onSelect(resource)}
                        >
                          <span className="chat-listing-copy">
                            <strong>{resource.name}</strong>
                            <span>
                              {resource.city || resource.serviceLabel}
                            </span>
                          </span>
                          <Icon name="arrow" size={16} />
                        </button>
                      ))}
                  </div>
                )}
              </article>
            ))}
            {busy && <LoadingIndicator label="Thinking…" dots />}
            {error && (
              <p className="notice" role="alert">
                {error}
              </p>
            )}
          </div>
          <form className="chat-composer" onSubmit={sendMessage}>
            <textarea
              spellCheck={true}
              autoCorrect="on"
              autoCapitalize="sentences"
              enterKeyHint="send"
              aria-label="Message the assistant"
              rows={2}
              maxLength={1200}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask for help…"
              disabled={busy}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(event);
                }
              }}
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={busy || !question.trim()}
            >
              <Icon name="arrow" size={20} />
            </button>
          </form>
        </>
      )}
    </section>
  );
}
