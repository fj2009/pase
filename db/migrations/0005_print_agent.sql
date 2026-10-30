-- API del agente local de impresión. El agente se autentica con un token
-- propio (hash SHA-256 en base de datos) y solo puede reclamar trabajos de su
-- restaurante. Nunca se expone el servicio local a internet.

CREATE OR REPLACE FUNCTION api.agent_claim(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_agent print_agents%ROWTYPE;
  v_job print_jobs%ROWTYPE;
  v_printer printers%ROWTYPE;
BEGIN
  SELECT * INTO v_agent
  FROM print_agents
  WHERE token_hash = p_token_hash AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  UPDATE print_agents SET last_seen_at = now() WHERE id = v_agent.id;

  SELECT pj.* INTO v_job
  FROM print_jobs pj
  WHERE pj.restaurant_id = v_agent.restaurant_id
    AND pj.status = 'pending'
    AND pj.next_attempt_at <= now()
  ORDER BY pj.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'job', NULL);
  END IF;

  UPDATE print_jobs
  SET status = 'processing', attempts = attempts + 1
  WHERE id = v_job.id;

  SELECT * INTO v_printer FROM printers WHERE id = v_job.printer_id;

  RETURN jsonb_build_object(
    'ok', true,
    'job', jsonb_build_object(
      'id', v_job.id,
      'attempt', v_job.attempts + 1,
      'payload', v_job.payload,
      'printer', jsonb_build_object(
        'name', v_printer.name,
        'kind', v_printer.kind,
        'target', v_printer.target,
        'paper_width', v_printer.paper_width
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION api.agent_complete(
  p_token_hash text,
  p_job_id uuid,
  p_ok boolean,
  p_error text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_agent print_agents%ROWTYPE;
  v_job print_jobs%ROWTYPE;
  v_status print_job_status;
BEGIN
  SELECT * INTO v_agent
  FROM print_agents
  WHERE token_hash = p_token_hash AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  SELECT * INTO v_job
  FROM print_jobs
  WHERE id = p_job_id AND restaurant_id = v_agent.restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_job.status = 'printed' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'printed', 'duplicate', true);
  END IF;

  IF v_job.status <> 'processing' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_processing');
  END IF;

  IF p_ok THEN
    UPDATE print_jobs
    SET status = 'printed', printed_at = now(), last_error = NULL
    WHERE id = v_job.id;
    v_status := 'printed';
  ELSIF v_job.attempts >= 3 THEN
    UPDATE print_jobs
    SET status = 'failed', last_error = left(coalesce(p_error, 'Error desconocido'), 500)
    WHERE id = v_job.id;
    v_status := 'failed';
  ELSE
    UPDATE print_jobs
    SET status = 'pending',
        last_error = left(coalesce(p_error, 'Error desconocido'), 500),
        next_attempt_at = now() + make_interval(secs => 15 * v_job.attempts)
    WHERE id = v_job.id;
    v_status := 'pending';
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

GRANT EXECUTE ON FUNCTION api.agent_claim(text) TO pase_app;
GRANT EXECUTE ON FUNCTION api.agent_complete(text, uuid, boolean, text) TO pase_app;
