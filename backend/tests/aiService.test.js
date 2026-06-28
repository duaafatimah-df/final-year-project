const mockGenerateContent = jest.fn();
global.mockGenerateContent = mockGenerateContent;

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: jest.fn().mockImplementation((...args) => {
            return global.mockGenerateContent(...args);
          })
        })
      };
    })
  };
});

process.env.GEMINI_API_KEY = 'mock-api-key';
const aiService = require('../utils/aiService');

describe('AI Service Multi-Image Quality & Safety Verification Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateContent.mockReset();
  });

  it('should analyze multiple images in parallel and filter out unsafe items', async () => {
    // Mock the Gemini responses for 2 different images
    // First image (safe food): Approved, score 90
    // Second image (unsafe food): Rejected, score 30
    mockGenerateContent
      .mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            status: "approved",
            safetyScore: 90,
            reason: "Looks very fresh and safe.",
            keywords: ["fresh", "food"],
            classifiedCategory: "Food"
          })
        }
      })
      .mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            status: "rejected",
            safetyScore: 30,
            reason: "Spoiled, bad smell and mold visible.",
            keywords: ["spoiled", "moldy"],
            classifiedCategory: "Food"
          })
        }
      });

    const images = [
      "data:image/jpeg;base64,image1base64data...",
      "data:image/jpeg;base64,image2base64data..."
    ];

    const result = await aiService.analyzeItem(images, "Food");

    expect(result.status).toEqual("approved"); // Since 1 item is safe, status is determined by the safe item(s)
    expect(result.safetyScore).toEqual(90);
    expect(result.safeImages).toHaveLength(1);
    expect(result.safeImages[0]).toEqual(images[0]); // Only the first image is safe
    expect(result.hasRejectedItems).toBe(true);
    expect(result.reason).toContain("Image 1 (Food): Approved (90%)");
    expect(result.reason).toContain("Image 2 (Food): Rejected - Spoiled");
  });

  it('should approve cooked meals even if unsealed or home-cooked', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify({
          status: "approved",
          safetyScore: 95,
          reason: "Freshly cooked warm Biryani dish.",
          keywords: ["biryani", "cooked", "rice"],
          classifiedCategory: "Food"
        })
      }
    });

    const result = await aiService.analyzeItem("data:image/jpeg;base64,biryani...", "Food");

    expect(result.status).toEqual("approved");
    expect(result.safetyScore).toBeGreaterThanOrEqual(80);
    expect(result.classifiedCategory).toEqual("Food");
  });

  it('should approve medicines with minor cosmetic packaging damage', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify({
          status: "approved",
          safetyScore: 85,
          reason: "Slight outer box cosmetic damage, bottle is completely intact.",
          keywords: ["medicine", "tablet"],
          classifiedCategory: "Medicine"
        })
      }
    });

    // Mock OCR to be successful
    jest.spyOn(aiService, 'extractExpiry').mockResolvedValueOnce({
      isValid: true,
      expiryDate: '2026-12-31',
      message: 'Active'
    });

    const result = await aiService.analyzeItem("data:image/jpeg;base64,med...", "Medicine");

    expect(result.status).toEqual("approved");
    expect(result.safetyScore).toBeGreaterThanOrEqual(70);
    expect(result.reason).toContain("Slight outer box cosmetic damage");
  });
});
