
import { embeddableURLValidator } from "../src/embeddable";

describe("embeddableURLValidator", () => {
  it("should allow any URL by default", () => {
    const randomUrl = "https://www.example.com/some/path";
    expect(embeddableURLValidator(randomUrl, undefined)).toBe(true);
  });

  it("should still respect custom validator returning false", () => {
    const url = "https://www.example.com";
    const validator = () => false;
    expect(embeddableURLValidator(url, validator)).toBe(false);
  });

  it("should still respect custom validator returning true", () => {
    const url = "https://www.example.com";
    const validator = () => true;
    expect(embeddableURLValidator(url, validator)).toBe(true);
  });
});
