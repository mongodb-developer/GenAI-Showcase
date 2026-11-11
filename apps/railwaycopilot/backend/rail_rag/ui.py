import streamlit as st
from rail_rag.prompt_presets import PRESETS
from rail_rag.prompt_utils import build_system_prompt

def render_prompt_lab():
    with st.sidebar:
        st.header("🧪 Prompt Lab")

        preset_name = st.selectbox("Preset", list(PRESETS.keys()), index=0)
        base_prompt = PRESETS[preset_name]

        st.caption("Adjust global behavior")
        force_citations = st.checkbox("Always include citations", value=True)
        refuse_if_ooc   = st.checkbox("Refuse if not in context", value=True)
        bulleted_style  = st.checkbox("Bulleted style", value=("Bulleted" in preset_name))
        structured_style = st.checkbox("Structured sections", value=("Structured" in preset_name))

        extra_instructions = st.text_area(
            "Extra instructions (optional)",
            value="",
            help="Add domain-specific constraints, formatting, or terminology."
        )

        st.divider()
        st.caption("Generation controls")
        temperature = st.slider("Temperature", 0.0, 1.5, 0.2, 0.05)
        max_tokens  = st.slider("Max tokens", 128, 2048, 512, 32)

        st.divider()
        st.caption("Few-shot examples (optional)")
        use_fewshot = st.checkbox("Enable few-shot examples", value=False)
        fewshot_pairs = []
        if use_fewshot:
            with st.expander("Add examples"):
                ex_user = st.text_area("User example", value="What must a signaller do when going off duty?")
                ex_assistant = st.text_area("Assistant example", value=(
                    "• Notify relief signaller and transfer any ongoing movements.\n"
                    "• Record handover in logbook.\nSources: (Rulebook.pdf p.12)"
                ))
                if st.button("Add example"):
                    st.session_state.setdefault("fewshots", [])
                    st.session_state["fewshots"].append(("human", ex_user))
                    st.session_state["fewshots"].append(("assistant", ex_assistant))
            fewshot_pairs = st.session_state.get("fewshots", [])

        st.divider()
        ab_test = st.checkbox(
            "Run A/B prompt experiment",
            value=False,
            help=(
                "Compare two prompts side-by-side.\n\n"
                "🅰️ Prompt A — uses your current sidebar settings (preset + toggles + extra instructions + few-shots).\n"
                "🅱️ Prompt B — same base preset but forces: citations, bullet + structured format, and same 'Refuse if not in context'."
            ),
        )

    active_system_prompt = build_system_prompt(
        base_prompt,
        {
            "force_citations": force_citations,
            "refuse_if_ooc": refuse_if_ooc,
            "bulleted_style": bulleted_style,
            "structured_style": structured_style,
        },
        extra_instructions,
    )

    return {
        "preset_name": preset_name,
        "base_prompt": base_prompt,
        "force_citations": force_citations,
        "refuse_if_ooc": refuse_if_ooc,
        "bulleted_style": bulleted_style,
        "structured_style": structured_style,
        "extra_instructions": extra_instructions,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "use_fewshot": use_fewshot,
        "fewshot_pairs": few_shots if (few_shots := fewshot_pairs) else [],
        "ab_test": ab_test,
        "active_system_prompt": active_system_prompt,
    }
