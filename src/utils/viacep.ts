export interface ViaCepResult {
  cep: string;
  street: string;
  city: string;
  state: string;
  neighborhood: string | null;
}

export function formatCEPInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export async function fetchCep(cep: string): Promise<ViaCepResult | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  let response: Response;
  try {
    response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const data = (await response.json()) as {
    cep?: string;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
    erro?: boolean;
  };

  if (data.erro) return null;

  return {
    cep: digits,
    street: data.logradouro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
    neighborhood: data.bairro ?? null,
  };
}
