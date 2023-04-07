import { AxiosRequestConfig, default as axios } from 'axios';
import { ResponseCodes, Routes } from '../helpers/constants.helper';
import {
  ApiResponse,
  ApplicationData,
  CommonSuccess,
  FullUserData,
  UploadedApplicatioData,
  UserResponseData,
} from '../interfaces/api';
import errorManager from '../managers/error.manager';
import FormData = require('form-data');

class ApiService {
  private readonly baseUrl = 'https://api.squarecloud.app/v1/public/';
  public readonly apiKey?: string;

  user(userId?: string): Promise<ApiResponse<UserResponseData> | undefined> {
    return this.fetch(`user${userId ? `/${userId}` : ''}`);
  }

  application(
    path: string,
    id: string,
    data?: FormData
  ): Promise<ApiResponse | undefined> {
    const options = data
      ? {
          data,
          headers: data.getHeaders(),
        }
      : undefined;

    return this.fetch(`${path}/${id}`, options);
  }

  async fetch(
    path: string,
    options: AxiosRequestConfig = {}
  ): Promise<ApiResponse | undefined> {
    if (!this.apiKey) {
      return;
    }

    options.headers = {
      ...(options.headers || {}),
      authorization: this.apiKey,
    };

    const res = await axios(`${this.baseUrl}${path}`, options).catch(
      errorManager.handleError
    );

    return res?.data;
  }

  async upload(
    file: Buffer
  ): Promise<CommonSuccess<UploadedApplicatioData> | undefined> {
    const formData = new FormData();
    formData.append('file', file, { filename: 'app.zip' });

    const data = (await this.fetch(Routes.Upload, {
      method: 'POST',
      data: formData,
      headers: formData.getHeaders(),
    })) as any;

    const { app, code } = data || {};

    return {
      success: code === ResponseCodes.Success,
      data: { id: app?.id, tag: app?.tag, ram: app?.ram },
    };
  }

  hasAccess(
    value: UserResponseData
  ): value is { user: FullUserData; applications: ApplicationData[] } {
    return Boolean(value.user.email) && value.user.email !== 'Access denied';
  }

  setApiKey(apiKey: string) {
    Reflect.set(this, 'apiKey', apiKey);
    return this;
  }
}

export default new ApiService();
