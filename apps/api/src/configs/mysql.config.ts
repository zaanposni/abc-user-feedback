/**
 * Copyright 2023 LINE Corporation
 *
 * LINE Corporation licenses this file to you under the Apache License,
 * version 2.0 (the "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at:
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */
import { registerAs } from '@nestjs/config';
import * as yup from 'yup';

export const mySqlConfigSchema = yup.object({
  MYSQL_PRIMARY_URL: yup
    .string()
    .default('mysql://userfeedback:userfeedback@localhost:13306/userfeedback'),
  MYSQL_SECONDARY_URLS: yup
    .string()
    .default(
      '["mysql://userfeedback:userfeedback@localhost:13306/userfeedback"]',
    ),
});

export const mysqlConfig = registerAs('mysql', () => ({
  main_url: process.env.MYSQL_PRIMARY_URL,
  sub_urls: toArray(process.env.MYSQL_SECONDARY_URLS),
}));

const toArray = (input: string) => {
  try {
    return JSON.parse(input);
  } catch (error) {
    return [];
  }
};
