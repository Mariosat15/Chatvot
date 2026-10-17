import { describe, expect, it } from "vitest";
import {
  contactUsTransferMessage,
  matchContactUsPackage,
} from "@/lib/services/gamemaster/contact-us-support";
import { contactUsChatHref } from "@/lib/services/gamemaster/contact-us-package";

describe("matchContactUsPackage", () => {
  const names = ["Pro", "Pro Plus", "Elite Partner"];

  it("matches the pre-filled marketplace message for a contact-us package", () => {
    const topic = decodeURIComponent(contactUsChatHref("Elite Partner").split("topic=")[1]);
    expect(matchContactUsPackage(topic, names)).toBe("Elite Partner");
  });

  it("prefers the longest package name", () => {
    expect(matchContactUsPackage("how do I get pro  plus?", names)).toBe("Pro Plus");
  });

  it("treats a generic contact-us GM package request as a handoff with no name", () => {
    expect(matchContactUsPackage("I want to contact you about a GM package", names)).toBe("");
  });

  it("does not hand off ordinary messages or when no contact-us package exists", () => {
    expect(matchContactUsPackage("How do withdrawals work?", names)).toBeNull();
    expect(matchContactUsPackage("I want the Elite Partner package", [])).toBeNull();
    expect(matchContactUsPackage("how much is a gm package", names)).toBeNull();
  });

  it("tells the player they are being transferred to a person", () => {
    const msg = contactUsTransferMessage("Elite Partner", "Anna");
    expect(msg).toContain('The "Elite Partner" Game Master package');
    expect(msg).toContain("transferring you to a member of our team");
    expect(msg).toContain("Anna");
    expect(contactUsTransferMessage("", "Anna")).toMatch(/^This Game Master package/);
  });
});
