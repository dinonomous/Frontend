from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, START
from config import get_llm_dyn


class State(TypedDict):
    messages: Annotated[list, add_messages]


graph_builder = StateGraph(State)


def chatbot_node(state: State):
    response = get_llm_dyn().invoke(state["messages"])
    return {"messages": [response]}


graph_builder.add_node("chatbot", chatbot_node)
graph_builder.add_edge(START, "chatbot")

chat_graph = graph_builder.compile()
