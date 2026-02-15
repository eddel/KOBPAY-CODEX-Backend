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
      return `${normalizeLower(
        (payload as Extract<BeneficiaryPayload, { network: string }>).network
      )}:${normalizeDigits(
        (payload as Extract<BeneficiaryPayload, { phone: string }>).phone
      )}`;
    case "cable":
      return `${normalizeLower(
        (payload as Extract<BeneficiaryPayload, { provider: string }>).provider
      )}:${normalizeDigits(
        (payload as Extract<BeneficiaryPayload, { smartNo: string }>).smartNo
      )}`;
    case "electricity":
      return `${normalizeLower(
        (payload as Extract<BeneficiaryPayload, { serviceCode: string }>).serviceCode
      )}:${normalizeDigits(
        (payload as Extract<BeneficiaryPayload, { meterNo: string }>).meterNo
      )}:${normalizeLower(
        (payload as Extract<BeneficiaryPayload, { meterType: string }>).meterType
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
        network: normalizeLower(
          (payload as Extract<BeneficiaryPayload, { network: string }>).network
        ) as "mtn" | "airtel" | "glo" | "9mobile",
        phone: normalizeDigits(
          (payload as Extract<BeneficiaryPayload, { phone: string }>).phone
        )
      };
    case "cable":
      return {
        provider: normalizeLower(
          (payload as Extract<BeneficiaryPayload, { provider: string }>).provider
        ) as "gotv" | "dstv" | "startimes",
        smartNo: normalizeDigits(
          (payload as Extract<BeneficiaryPayload, { smartNo: string }>).smartNo
        ),
        planVariation: (payload as Extract<
          BeneficiaryPayload,
          { planVariation?: string }
        >).planVariation
          ? normalizeLower(
              (payload as Extract<BeneficiaryPayload, { planVariation?: string }>)
                .planVariation ?? ""
            )
          : undefined
      };
    case "electricity":
      return {
        serviceCode: normalizeLower(
          (payload as Extract<BeneficiaryPayload, { serviceCode: string }>).serviceCode
        ),
        meterNo: normalizeDigits(
          (payload as Extract<BeneficiaryPayload, { meterNo: string }>).meterNo
        ),
        meterType: normalizeLower(
          (payload as Extract<BeneficiaryPayload, { meterType: string }>).meterType
        ) as "prepaid" | "postpaid"
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
      return `${(payload as Extract<
        BeneficiaryPayload,
        { network: string }
      >).network.toUpperCase()} ${(payload as Extract<
        BeneficiaryPayload,
        { phone: string }
      >).phone}`;
    case "cable":
      return `${(payload as Extract<
        BeneficiaryPayload,
        { provider: string }
      >).provider.toUpperCase()} ${(payload as Extract<
        BeneficiaryPayload,
        { smartNo: string }
      >).smartNo}`;
    case "electricity":
      return `${(payload as Extract<
        BeneficiaryPayload,
        { serviceCode: string }
      >).serviceCode.replace(/-electric$/, "").toUpperCase()} ${(payload as Extract<
        BeneficiaryPayload,
        { meterNo: string }
      >).meterNo}`;
    default:
      return "Beneficiary";
  }
};
