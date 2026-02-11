export type BeneficiaryCategory = "airtime" | "data" | "cable" | "electricity";

export type BeneficiaryPayload =
  | { network: "mtn" | "airtel" | "glo" | "9mobile"; phone: string }
  | { provider: "gotv" | "dstv" | "startimes"; smartNo: string; planVariation?: string }
  | { serviceCode: string; meterNo: string; meterType: "prepaid" | "postpaid" };

const normalizeDigits = (value: string) => value.replace(/\D/g, "");

const normalizeLower = (value: string) => value.trim().toLowerCase();

export const buildBeneficiaryKey = (
  category: BeneficiaryCategory,
  payload: BeneficiaryPayload
) => {
  switch (category) {
    case "airtime":
    case "data":
      return `${normalizeLower(payload.network)}:${normalizeDigits(payload.phone)}`;
    case "cable":
      return `${normalizeLower(payload.provider)}:${normalizeDigits(payload.smartNo)}`;
    case "electricity":
      return `${normalizeLower(payload.serviceCode)}:${normalizeDigits(payload.meterNo)}:${normalizeLower(
        payload.meterType
      )}`;
    default:
      return "unknown";
  }
};

export const normalizePayload = (
  category: BeneficiaryCategory,
  payload: BeneficiaryPayload
) => {
  switch (category) {
    case "airtime":
    case "data":
      return {
        network: normalizeLower(payload.network) as "mtn" | "airtel" | "glo" | "9mobile",
        phone: normalizeDigits(payload.phone)
      };
    case "cable":
      return {
        provider: normalizeLower(payload.provider) as "gotv" | "dstv" | "startimes",
        smartNo: normalizeDigits(payload.smartNo),
        planVariation: payload.planVariation ? normalizeLower(payload.planVariation) : undefined
      };
    case "electricity":
      return {
        serviceCode: normalizeLower(payload.serviceCode),
        meterNo: normalizeDigits(payload.meterNo),
        meterType: normalizeLower(payload.meterType) as "prepaid" | "postpaid"
      };
    default:
      return payload;
  }
};

export const buildBeneficiaryLabelSuggestion = (
  category: BeneficiaryCategory,
  payload: BeneficiaryPayload
) => {
  switch (category) {
    case "airtime":
    case "data":
      return `${payload.network.toUpperCase()} ${payload.phone}`;
    case "cable":
      return `${payload.provider.toUpperCase()} ${payload.smartNo}`;
    case "electricity":
      return `${payload.serviceCode.replace(/-electric$/, "").toUpperCase()} ${payload.meterNo}`;
    default:
      return "Beneficiary";
  }
};
