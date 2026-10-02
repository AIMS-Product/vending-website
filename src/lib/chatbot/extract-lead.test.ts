import { describe, expect, it } from "vitest";
import { extractLead } from "./extract-lead";

describe("extractLead, email", () => {
  it.each([
    ["Reach me at Jane.Doe@Example.com", "jane.doe@example.com"],
    ["my email is jane@example.com.", "jane@example.com"],
    ["(jane@example.com)", "jane@example.com"],
    [
      "<jane+vending@mail.example.co.uk>, thanks",
      "jane+vending@mail.example.co.uk",
    ],
    ["jane@example.com, bob@example.com", "jane@example.com"],
  ])("finds the address in %j", (text, expected) => {
    expect(extractLead(text).email).toBe(expected);
  });

  it.each([
    "no address here",
    "tag me @jane on social",
    "jane@localhost",
    "jane@",
  ])("returns null for %j", (text) => {
    expect(extractLead(text).email).toBeNull();
  });
});

describe("extractLead, phone", () => {
  it.each([
    ["call me at 415-555-2671", "4155552671"],
    ["(415) 555-2671", "4155552671"],
    ["415.555.2671", "4155552671"],
    ["415 555 2671", "4155552671"],
    ["4155552671", "4155552671"],
    ["+1 415 555 2671", "4155552671"],
    ["1-415-555-2671", "4155552671"],
    ["my number: (212)555-0100 thanks", "2125550100"],
  ])("normalises %j to digits", (text, expected) => {
    expect(extractLead(text).phone).toBe(expected);
  });

  it.each([
    "I have 3 machines and about $5,000 saved",
    "I started in 2026 with 12 locations",
    "my budget is $25000",
    "order 0123456789",
    "area code 155 is not real: 155-555-2671",
    "call 555-2671",
  ])("ignores numbers that only look like a phone: %j", (text) => {
    expect(extractLead(text).phone).toBeNull();
  });

  it("does not read a UK mobile as a US number", () => {
    expect(extractLead("+44 7911 123456").phone).toBeNull();
  });
});

describe("extractLead, name", () => {
  it.each([
    ["my name is john smith", "John Smith"],
    ["My name is Maria", "Maria"],
    ["Hi, this is Dave", "Dave"],
    ["I'm Priya Natarajan", "Priya Natarajan"],
    ["its Sam", "Sam"],
    ["it's Alex Rivera", "Alex Rivera"],
    ["my name is John Smith and my email is john@example.com", "John Smith"],
  ])("pulls the name from %j", (text, expected) => {
    expect(extractLead(text).name).toBe(expected);
  });

  it.each([
    "I'm interested in vending",
    "I'm not sure yet",
    "I'm currently working full time",
    "I'm self-employed",
    "it's free right?",
    "this is great",
    "I'm already running two machines",
    "what does it cost",
    "",
  ])("rejects a phrase that is not a name: %j", (text) => {
    expect(extractLead(text).name).toBeNull();
  });

  it("stops at the first stopword instead of absorbing the next clause", () => {
    expect(extractLead("my name is Dana and I'm in Texas").name).toBe("Dana");
  });
});

describe("extractLead, combined", () => {
  it("returns every field independently", () => {
    expect(
      extractLead(
        "I'm Chris Lee, text 312-555-0188 or email chris@example.com",
      ),
    ).toEqual({
      email: "chris@example.com",
      phone: "3125550188",
      name: "Chris Lee",
    });
  });

  it("returns all nulls for small talk", () => {
    expect(extractLead("how does the process work?")).toEqual({
      email: null,
      phone: null,
      name: null,
    });
  });
});
