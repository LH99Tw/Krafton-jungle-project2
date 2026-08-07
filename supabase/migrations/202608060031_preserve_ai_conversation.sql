create or replace function public.complete_ai_mission(p_user_id bigint, p_event_type text, p_evidence jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_progress ai_mission_progress%rowtype; v_mission ai_missions%rowtype; v_balance bigint; v_valid boolean := false;
begin
  select * into v_progress from ai_mission_progress where user_id = p_user_id and status = 'ACTIVE' for update;
  if not found then return jsonb_build_object('completed', false); end if;
  select * into v_mission from ai_missions where id = v_progress.mission_id and active = true;
  if not found or v_mission.event_type <> p_event_type then return jsonb_build_object('completed', false); end if;
  if v_mission.id = 'draft-story' then
    v_valid := p_evidence->>'status' = 'DRAFT' and coalesce((p_evidence->>'titleLength')::integer, 0) > 0 and coalesce((p_evidence->>'contentLength')::integer, 0) >= 30;
  elsif v_mission.id = 'interest-classification' then
    v_valid := coalesce((p_evidence->>'interestClassificationCount')::integer, 0) > 0;
  elsif v_mission.id = 'market-visit' then
    v_valid := p_event_type = 'MARKET_DETAIL_VIEWED';
  end if;
  if not v_valid then return jsonb_build_object('completed', false); end if;

  update ai_mission_progress set status = 'COMPLETED', completed_at = now(), updated_at = now() where id = v_progress.id;
  update ai_conversations set mode = 'GENERAL', mission_id = null, status = 'ACTIVE', updated_at = now() where id = v_progress.conversation_id;
  insert into ai_messages (conversation_id, user_id, role, body, status, completed_at)
    values (v_progress.conversation_id, p_user_id, 'SYSTEM', '미션 완료가 확인됐어요. 일반 대화로 돌아왔습니다.', 'COMPLETED', now());
  insert into wallets (user_id, balance) values (p_user_id, 0) on conflict do nothing;
  update wallets set balance = balance + v_progress.reward_points, updated_at = now() where user_id = p_user_id returning balance into v_balance;
  insert into wallet_transactions (user_id, mission_progress_id, type, amount, balance_after)
    values (p_user_id, v_progress.id, 'MISSION_REWARD', v_progress.reward_points, v_balance)
    on conflict (mission_progress_id) where mission_progress_id is not null do nothing;
  return jsonb_build_object('completed', true, 'missionId', v_progress.mission_id, 'rewardPoints', v_progress.reward_points, 'balance', v_balance);
end;
$$;

revoke all on function public.complete_ai_mission(bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.complete_ai_mission(bigint, text, jsonb) to service_role;
