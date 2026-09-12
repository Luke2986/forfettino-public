CREATE OR REPLACE FUNCTION public._admin_rotate_vault_secret(_name text, _value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE _id uuid;
BEGIN
  SELECT id INTO _id FROM vault.secrets WHERE name = _name;
  IF _id IS NULL THEN
    RAISE EXCEPTION 'secret % not found', _name;
  END IF;
  PERFORM vault.update_secret(_id, _value, _name);
END;
$$;
GRANT EXECUTE ON FUNCTION public._admin_rotate_vault_secret(text, text) TO sandbox_exec;